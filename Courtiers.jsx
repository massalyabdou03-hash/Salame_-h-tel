import { useState } from 'react'
import { Handshake, Check, Undo2, Wallet, Banknote } from 'lucide-react'
import { supabase } from './supabase'
import { fcfa, fdate } from './utils'
import { Field, PageHeader, Section, Stat, Empty, useNotify } from './ui'

// Les heures sont affichées à l'heure de Dakar, quelle que soit l'heure réglée sur l'ordinateur
const DAKAR = { timeZone: 'Africa/Dakar' }
const dDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', DAKAR)
const dTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { ...DAKAR, hour: '2-digit', minute: '2-digit' })
const dMonth = (ts) => new Date(ts).toLocaleDateString('sv-SE', DAKAR).slice(0, 7)

const sum = (rows) => rows.reduce((s, b) => s + Number(b.commission_amount), 0)
const pct = (b) => (Number(b.total_amount) > 0 ? Math.round((Number(b.commission_amount) / Number(b.total_amount)) * 100) : 0)

export default function Courtiers({ data, reload }) {
  const { toast, confirm } = useNotify()
  const brokers = data.brokers ?? []
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null) // courtier dont le détail est affiché
  const [busyId, setBusyId] = useState(null) // réservation en cours de mise à jour
  const [month, setMonth] = useState('')

  const nameOf = Object.fromEntries(brokers.map((x) => [x.id, x.name]))

  // Toutes les réservations qui ont une commission ; les annulées ne comptent plus dans les totaux
  const withComm = data.bookings.filter((b) => b.broker_id && Number(b.commission_amount) > 0)
  const live = withComm.filter((b) => b.status !== 'annulee')
  const earned = sum(live)
  const paid = sum(live.filter((b) => b.commission_paid_at))
  const rest = earned - paid

  const statsOf = (id) => {
    const mine = live.filter((b) => b.broker_id === id)
    const done = mine.filter((b) => b.commission_paid_at)
    return { earned: sum(mine), paid: sum(done), rest: sum(mine) - sum(done) }
  }

  // Historique : tout l'argent réellement versé, du plus récent au plus ancien
  const history = withComm
    .filter((b) => b.commission_paid_at && (!month || dMonth(b.commission_paid_at) === month))
    .sort((x, y) => new Date(y.commission_paid_at) - new Date(x.commission_paid_at))

  const add = async (e) => {
    e.preventDefault()
    setErr('')
    const n = name.trim()
    if (!n) return setErr('Écrivez le nom du courtier.')
    setBusy(true)
    const { error } = await supabase.from('brokers').insert({ name: n, phone: phone.trim() || null })
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'Ce courtier existe déjà.' : `Le courtier n'a pas pu être enregistré : ${error.message}`)
    toast(`Le courtier « ${n} » a été ajouté.`)
    setName(''); setPhone('')
    reload()
  }

  // L'heure du versement est fixée par le serveur (pas par l'ordinateur)
  const setPaid = async (b, paidNow) => {
    const who = nameOf[b.broker_id]
    const ok = await confirm(
      paidNow
        ? { title: 'Marquer comme versée ?', message: `Confirmez-vous avoir versé ${fcfa(b.commission_amount)} à ${who} ?\n\nLa date et l'heure du versement seront enregistrées.`, confirmLabel: "Oui, c'est versé" }
        : { title: 'Annuler ce versement ?', message: `La commission de ${fcfa(b.commission_amount)} pour ${who} repassera dans « Reste à verser ».`, confirmLabel: 'Oui, annuler le versement', cancelLabel: 'Non, le garder', danger: true }
    )
    if (!ok) return
    setBusyId(b.id)
    const { error } = await supabase.from('bookings').update({ commission_paid_at: paidNow ? new Date().toISOString() : null }).eq('id', b.id)
    setBusyId(null)
    if (error) return toast(`Le changement n'a pas pu être enregistré : ${error.message}`, 'error')
    toast(paidNow ? `Versement de ${fcfa(b.commission_amount)} à ${who} enregistré.` : 'Le versement a été annulé.')
    reload()
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Courtiers" subtitle="Les commissions gagnées et versées aux courtiers" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Commissions gagnées" value={fcfa(earned)} Icon={Handshake} tone="slate" />
        <Stat label="Déjà versé" value={fcfa(paid)} Icon={Wallet} tone="green" />
        <Stat label="Reste à verser" value={fcfa(rest)} Icon={Banknote} tone={rest > 0 ? 'amber' : 'green'} />
      </div>

      <form onSubmit={add} className="card space-y-4">
        <h2 className="text-lg font-bold">Ajouter un courtier</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Téléphone (facultatif)"><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Enregistrement…' : 'Ajouter le courtier'}</button>
      </form>

      <Section title="Liste des courtiers">
      <ul className="grid gap-4 xl:grid-cols-2">
        {brokers.length === 0 && (
          <li className="xl:col-span-2"><Empty>Aucun courtier pour l'instant. Ajoutez-en un ci-dessus, ou directement dans une réservation.</Empty></li>
        )}
        {brokers.map((br) => {
          const st = statsOf(br.id)
          const rows = withComm.filter((b) => b.broker_id === br.id)
          return (
            <li key={br.id} className="card space-y-3 self-start">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{br.name}</p>
                  {br.phone && <p className="text-xs text-slate-500">{br.phone}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Reste à verser</p>
                  <p className={`text-lg font-bold ${st.rest > 0 ? 'text-amber-700' : 'text-salam-700'}`}>{fcfa(st.rest)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Gagné {fcfa(st.earned)} · Versé {fcfa(st.paid)} · {rows.length} réservation{rows.length > 1 ? 's' : ''} avec commission
              </p>
              {rows.length > 0 && (
                <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={() => setOpen(open === br.id ? null : br.id)}>
                  {open === br.id ? 'Masquer le détail' : 'Voir le détail'}
                </button>
              )}
              {open === br.id && (
                <ul className="divide-y border-t">
                  {rows.map((b) => {
                    const cancelled = b.status === 'annulee'
                    return (
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{b.units?.name} · {b.clients?.first_name} {b.clients?.last_name}</p>
                          <p className="text-xs text-slate-500">
                            {fdate(b.check_in)} → {fdate(b.check_out)} · commission {fcfa(b.commission_amount)} ({pct(b)} % du total)
                          </p>
                          {cancelled && !b.commission_paid_at && <p className="text-xs text-slate-500">Réservation annulée : commission non due</p>}
                          {cancelled && b.commission_paid_at && <p className="text-xs text-red-700">Réservation annulée alors que la commission a été versée</p>}
                          {b.commission_paid_at && <p className="text-xs text-salam-700">Versée le {dDate(b.commission_paid_at)} à {dTime(b.commission_paid_at)}</p>}
                          {!cancelled && !b.commission_paid_at && <p className="text-xs text-amber-700">À verser</p>}
                        </div>
                        {b.commission_paid_at ? (
                          <button type="button" className="btn btn-secondary" disabled={busyId === b.id} onClick={() => setPaid(b, false)}>
                            <Undo2 size={16} /> Annuler le versement
                          </button>
                        ) : !cancelled && (
                          <button type="button" className="btn btn-primary" disabled={busyId === b.id} onClick={() => setPaid(b, true)}>
                            <Check size={16} /> Marquer versée
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      </Section>

      <Section title="Historique des versements" hint="Tout l'argent versé aux courtiers, du plus récent au plus ancien.">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Mois"><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <p className="ml-auto text-sm">Total versé : <b className="text-xl text-red-700">{fcfa(sum(history))}</b></p>
      </div>
      <ul className="space-y-2">
        {history.length === 0 && <li><Empty>Aucun versement enregistré.</Empty></li>}
        {history.map((b) => (
          <li key={b.id} className="card flex items-start gap-3 !p-3 text-sm">
            <div className="w-16 shrink-0 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">{dTime(b.commission_paid_at)}</p>
              <p>{dDate(b.commission_paid_at)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{nameOf[b.broker_id]}</p>
              <p className="truncate text-xs text-slate-500">
                {b.units?.name} · {b.clients?.first_name} {b.clients?.last_name} · {fdate(b.check_in)}
                {b.status === 'annulee' && <span className="text-red-700"> · réservation annulée</span>}
              </p>
            </div>
            <b className="shrink-0 text-red-700">− {fcfa(b.commission_amount)}</b>
          </li>
        ))}
      </ul>
      </Section>
    </div>
  )
}
