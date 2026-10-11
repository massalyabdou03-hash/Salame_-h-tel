import { useState } from 'react'
import { Plus, Pencil, FileText, CalendarCheck, Trash2, Ban, CalendarDays } from 'lucide-react'
import { supabase } from './supabase'
import { fcfa, fdate, today, addDays, nightsBetween } from './utils'
import { Field, PageHeader, Badge, Empty, useNotify } from './ui'

const STATUS = {
  en_attente: ['En attente', 'bg-sky-100 text-sky-800'],
  acceptee: ['Transformée en réservation', 'bg-emerald-100 text-emerald-800'],
  annulee: ['Annulée', 'bg-red-100 text-red-800'],
  expiree: ['Expirée', 'bg-amber-100 text-amber-800'],
}
const stateOf = (p) => (p.status === 'en_attente' && p.valid_until < today() ? 'expiree' : p.status)

const FILTERS = [
  ['all', 'Toutes'],
  ['en_attente', 'En attente'],
  ['acceptee', 'Transformées'],
  ['expiree', 'Expirées'],
  ['annulee', 'Annulées'],
]

function ProformaForm({ proforma, units, bookings, onDone, onCancel }) {
  const editing = Boolean(proforma)
  const [f, setF] = useState(
    editing
      ? {
          last_name: proforma.last_name, first_name: proforma.first_name || '', phone: proforma.phone || '',
          unit_id: proforma.unit_id ? String(proforma.unit_id) : '', check_in: proforma.check_in, check_out: proforma.check_out,
          price: String(proforma.price_per_night), total: String(proforma.total_amount), deposit: String(proforma.deposit),
          valid_until: proforma.valid_until, note: proforma.note || '',
        }
      : {
          last_name: '', first_name: '', phone: '', unit_id: '', check_in: today(), check_out: addDays(today(), 1),
          price: '', total: '', deposit: '0', valid_until: addDays(today(), 7), note: '',
        }
  )
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const unit = units.find((u) => String(u.id) === f.unit_id)
  const nights = nightsBetween(f.check_in, f.check_out)
  const price = f.price !== '' ? Number(f.price) : Number(unit?.price_per_night || 0)
  const total = f.total !== '' ? Number(f.total) : nights * price

  // Simple avertissement (ne bloque pas) : le logement est-il déjà pris sur ces dates ?
  const busyDates = unit && nights > 0 && bookings.some((b) => b.status !== 'annulee' && b.unit_id === unit.id && b.check_in < f.check_out && f.check_in < b.check_out)

  const pickUnit = (e) => {
    const u = units.find((x) => String(x.id) === e.target.value)
    setF({ ...f, unit_id: e.target.value, price: u ? String(u.price_per_night) : '', total: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!f.last_name.trim()) return setErr('Écrivez le nom du client.')
    if (!unit) return setErr('Choisissez un logement.')
    if (nights < 1) return setErr("La date de départ doit être après la date d'arrivée.")
    if (!(total >= 0)) return setErr('Le montant total est incorrect.')
    const deposit = Number(f.deposit || 0)
    if (deposit < 0 || deposit > total) return setErr("L'acompte ne peut pas dépasser le montant total.")
    if (f.valid_until < today()) return setErr('La date de validité est déjà passée.')

    setBusy(true)
    const payload = {
      last_name: f.last_name.trim(),
      first_name: f.first_name.trim(),
      phone: f.phone.trim() || null,
      unit_id: unit.id,
      unit_label: `${unit.name} (${unit.type})`,
      check_in: f.check_in,
      check_out: f.check_out,
      price_per_night: price,
      total_amount: total,
      deposit,
      valid_until: f.valid_until,
      note: f.note.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('proformas').update(payload).eq('id', proforma.id)
      : await supabase.from('proformas').insert(payload)
    setBusy(false)
    if (error) return setErr(`Le proforma n'a pas pu être enregistré : ${error.message}`)
    onDone(editing)
  }

  return (
    <form onSubmit={submit} className="card space-y-5 border-salam-600/40 !p-6 ring-1 ring-salam-600/10">
      <div>
        <h2 className="text-lg font-bold">{editing ? `Modifier le proforma ${proforma.number}` : 'Nouvelle facture proforma'}</h2>
        <p className="text-sm text-slate-500">Un devis pour un client, avant la réservation. Rien n'est compté dans les recettes.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nom du client"><input className="input" required value={f.last_name} onChange={set('last_name')} /></Field>
        <Field label="Prénom (facultatif)"><input className="input" value={f.first_name} onChange={set('first_name')} /></Field>
        <Field label="Téléphone (facultatif)"><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Logement">
          <select className="input" required value={f.unit_id} onChange={pickUnit}>
            <option value="">Choisir…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.type}</option>)}
          </select>
        </Field>
        <Field label="Date d'arrivée"><input className="input" type="date" required value={f.check_in} onChange={set('check_in')} /></Field>
        <Field label="Date de départ"><input className="input" type="date" required value={f.check_out} onChange={set('check_out')} /></Field>
      </div>
      {busyDates && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Attention : ce logement est déjà réservé sur une partie de ces dates. Le proforma peut quand même être créé.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Prix par nuit (FCFA)">
          <input className="input" type="number" min="0" inputMode="numeric" value={f.price} placeholder={String(unit?.price_per_night || 0)} onChange={(e) => setF({ ...f, price: e.target.value, total: '' })} />
        </Field>
        <Field label={`Montant total (${nights > 0 ? nights : 0} nuit${nights > 1 ? 's' : ''})`} hint="Calculé automatiquement. Écrivez un autre montant pour le changer.">
          <input className="input" type="number" min="0" inputMode="numeric" placeholder={String(nights > 0 ? nights * price : 0)} value={f.total} onChange={set('total')} />
        </Field>
        <Field label="Acompte demandé (facultatif)">
          <input className="input" type="number" min="0" inputMode="numeric" value={f.deposit} onChange={set('deposit')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Valable jusqu'au"><input className="input" type="date" required value={f.valid_until} onChange={set('valid_until')} /></Field>
        <Field label="Remarque (facultatif)" className="sm:col-span-2">
          <input className="input" placeholder="Ex. Petit-déjeuner non inclus" value={f.note} onChange={set('note')} />
        </Field>
      </div>

      <p className="rounded-xl bg-salam-50 p-3 text-sm">Total <b>{fcfa(total)}</b> · Acompte <b>{fcfa(f.deposit || 0)}</b> · Reste ensuite <b className="text-salam-700">{fcfa(total - Number(f.deposit || 0))}</b></p>
      {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le proforma'}</button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

export default function Proformas({ data, reload, openDoc, goNew }) {
  const { toast, confirm } = useNotify()
  const [form, setForm] = useState(null) // null | 'new' | proforma à modifier
  const [filter, setFilter] = useState('all')

  const list = data.proformas ?? []
  const counts = Object.fromEntries(FILTERS.map(([id]) => [id, id === 'all' ? list.length : list.filter((p) => stateOf(p) === id).length]))
  const rows = list.filter((p) => filter === 'all' || stateOf(p) === filter)

  const cancel = async (p) => {
    const ok = await confirm({
      title: 'Annuler ce proforma ?',
      message: `${p.number} pour ${p.last_name} sera marqué « Annulée ». Vous pourrez toujours le consulter.`,
      confirmLabel: 'Oui, annuler',
      cancelLabel: 'Non, le garder',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('proformas').update({ status: 'annulee' }).eq('id', p.id)
    if (error) return toast(`Le changement n'a pas pu être enregistré : ${error.message}`, 'error')
    toast('Le proforma a été annulé.')
    reload()
  }

  const remove = async (p) => {
    const ok = await confirm({
      title: 'Supprimer ce proforma ?',
      message: `${p.number} — ${p.last_name}, ${p.unit_label}, du ${fdate(p.check_in)} au ${fdate(p.check_out)}.\n\nCette action est définitive.`,
      confirmLabel: 'Oui, supprimer',
      cancelLabel: 'Non, le garder',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('proformas').delete().eq('id', p.id)
    if (error) return toast(`La suppression n'a pas pu être faite : ${error.message}`, 'error')
    toast('Le proforma a été supprimé.')
    reload()
  }

  // Ouvre le formulaire de réservation déjà rempli avec les informations du proforma
  const convert = (p) =>
    goNew(p.check_in, {
      proformaId: p.id,
      prefill: {
        last_name: p.last_name, first_name: p.first_name || '', phone: p.phone || '',
        unit_id: p.unit_id ? String(p.unit_id) : '', check_in: p.check_in, check_out: p.check_out,
        total: String(p.total_amount), advance: '0',
      },
    })

  return (
    <div className="space-y-6">
      <PageHeader title="Factures proforma" subtitle="Les devis envoyés aux clients avant la réservation">
        {!form && <button className="btn btn-primary btn-lg" onClick={() => setForm('new')}><Plus size={18} /> Nouveau proforma</button>}
      </PageHeader>

      {form && (
        <ProformaForm
          key={form === 'new' ? 'new' : form.id}
          proforma={form === 'new' ? undefined : form}
          units={data.units}
          bookings={data.bookings}
          onCancel={() => setForm(null)}
          onDone={(wasEdit) => {
            toast(wasEdit ? 'Les modifications ont été enregistrées.' : 'Le proforma a été créé. Vous pouvez maintenant l\'ouvrir en PDF.')
            setForm(null)
            reload()
          }}
        />
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`badge-filter ${filter === id ? 'badge-filter-active' : 'badge-filter-idle'}`}>
            {label} <span className="opacity-70">({counts[id]})</span>
          </button>
        ))}
      </div>

      <ul className="space-y-4">
        {rows.length === 0 && <li><Empty>{list.length === 0 ? "Aucun proforma pour l'instant. Cliquez sur « Nouveau proforma » pour en créer un." : 'Aucun proforma dans cette catégorie.'}</Empty></li>}
        {rows.map((p) => {
          const st = stateOf(p)
          const open = st === 'en_attente' || st === 'expiree'
          return (
            <li key={p.id} className={`card space-y-4 ${st === 'annulee' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{p.number}</p>
                  <h3 className="text-lg font-bold text-slate-900">{[p.first_name, p.last_name].filter(Boolean).join(' ')}</h3>
                  <p className="text-sm font-semibold text-salam-700">{p.unit_label}</p>
                </div>
                <Badge className={`!px-3 !py-1 ${STATUS[st][1]}`}>{STATUS[st][0]}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Séjour</p>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays size={15} className="shrink-0 text-slate-400" />{fdate(p.check_in)} → {fdate(p.check_out)}</p>
                  <p className="text-xs text-slate-500">{p.nights} nuit{p.nights > 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Montant total</p>
                  <p className="font-semibold">{fcfa(p.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Acompte demandé</p>
                  <p className="font-semibold">{Number(p.deposit) > 0 ? fcfa(p.deposit) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Valable jusqu'au</p>
                  <p className={`font-semibold ${st === 'expiree' ? 'text-amber-700' : ''}`}>{fdate(p.valid_until)}</p>
                </div>
              </div>

              <div className="section-divider">
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-secondary" onClick={() => openDoc({ type: 'proforma', proforma: p })}><FileText size={16} /> Voir / PDF</button>
                  {open && (
                    <>
                      <button className="btn btn-success" onClick={() => convert(p)}><CalendarCheck size={16} /> Transformer en réservation</button>
                      <button className="btn btn-secondary" onClick={() => { setForm(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil size={16} /> Modifier</button>
                    </>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    {open && <button className="btn btn-danger" onClick={() => cancel(p)}><Ban size={16} /> Annuler</button>}
                    <button className="btn btn-danger" onClick={() => remove(p)}><Trash2 size={16} /> Supprimer</button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
