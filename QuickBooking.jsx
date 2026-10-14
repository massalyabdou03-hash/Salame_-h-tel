import { useState } from 'react'
import { Minus, Plus, ChevronDown } from 'lucide-react'
import { supabase } from './supabase'
import { PAY_MODES, NR, fcfa, addDays, nightsBetween, fdate, today } from './utils'
import { Field, useNotify } from './ui'
import { longDate } from './calendar'

// Réservation rapide depuis le planning : on appuie sur une case vide et on ne voit que l'essentiel
// (nom du client, logement, montant, courtier facultatif, nombre de nuits).
// Tout le reste (prénom, téléphone, pièce d'identité, paiement, avance, remarque) est replié et facultatif.
export default function QuickBooking({ unit: unitProp, units = [], date, bookings, brokers = [], reloadBrokers, onDone, onMore, onCancel }) {
  const { toast } = useNotify()
  const picking = !unitProp // bouton « Écrire sur le planning » : on choisit aussi le jour
  const [unitId, setUnitId] = useState(unitProp ? String(unitProp.id) : '')
  const [start, setStart] = useState(date || today())
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [nights, setNights] = useState(1)
  const [brokerId, setBrokerId] = useState('')
  const [commission, setCommission] = useState('')
  const [newBroker, setNewBroker] = useState(null) // null = fermé ; sinon le nom en cours de saisie
  // Détails repliés
  const [first, setFirst] = useState('')
  const [phone, setPhone] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [payMode, setPayMode] = useState(PAY_MODES[0])
  const [advance, setAdvance] = useState('')
  const [note, setNote] = useState('')
  const [created, setCreated] = useState(null) // évite un doublon client si la réservation échoue
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const unit = units.find((u) => String(u.id) === unitId)

  // On ne peut pas aller au-delà de la prochaine réservation du même logement
  const next = bookings
    .filter((b) => b.status !== 'annulee' && b.unit_id === unit?.id && b.check_in > start)
    .map((b) => b.check_in)
    .sort()[0]
  const max = next ? nightsBetween(start, next) : 60
  const end = start ? addDays(start, nights) : ''
  const byDefault = nights * Number(unit?.price_per_night || 0)
  const total = amount !== '' ? Number(amount) : byDefault

  const addBroker = async () => {
    const n = (newBroker || '').trim()
    if (!n) return setErr('Écrivez le nom du courtier.')
    setErr('')
    const r = await supabase.from('brokers').insert({ name: n }).select().single()
    if (r.error) return setErr(r.error.code === '23505' ? 'Ce courtier existe déjà dans la liste.' : r.error.message)
    setBrokerId(String(r.data.id))
    setNewBroker(null)
    toast(`Le courtier « ${n} » a été ajouté.`)
    reloadBrokers?.()
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim()) return setErr('Écrivez le nom du client.')
    if (!unit) return setErr('Choisissez le logement.')
    if (!start || start < today()) return setErr("Choisissez un jour à partir d'aujourd'hui.")
    if (!(total >= 0)) return setErr('Le montant doit être un nombre positif.')
    const paid = Number(advance || 0)
    if (paid > total) return setErr("L'avance ne peut pas dépasser le montant total.")
    const comm = brokerId ? Number(commission || 0) : 0
    if (!(comm >= 0)) return setErr('La commission doit être un montant positif.')
    if (comm > total) return setErr('La commission ne peut pas dépasser le montant total.')
    setBusy(true)

    // Seul le nom est obligatoire : le reste est « Non renseigné » en base, à compléter plus tard
    let cid = created
    if (!cid) {
      const r = await supabase.from('clients').insert({ last_name: name.trim(), first_name: first.trim(), phone: phone.trim() || NR, id_number: idNumber.trim() || NR }).select().single()
      if (r.error) { setBusy(false); return setErr(r.error.message) }
      cid = r.data.id
      setCreated(cid)
    }

    const res = await supabase.from('bookings').insert({
      client_id: cid, unit_id: unit.id, check_in: start, check_out: end,
      payment_mode: payMode, total_amount: total, advance: paid,
      broker_id: brokerId ? Number(brokerId) : null, commission_amount: comm,
      note: note.trim() || null,
    })
    setBusy(false)
    if (res.error) {
      return setErr(
        res.error.code === '23P01' ? 'Ce logement est déjà pris sur ces dates.'
          : res.error.message.includes('commission') ? 'La commission ne peut pas dépasser le montant total.'
            : res.error.message,
      )
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="card space-y-4 !p-6">
      <div className="pr-10">
        {unit && <p className="text-sm font-semibold text-salam-700">{unit.name}</p>}
        <h2 className="text-lg font-extrabold text-slate-900">{picking ? 'Écrire sur le planning' : 'Nouvelle réservation'}</h2>
        {!picking && <p className="text-sm text-slate-500">À partir du {longDate(start)}</p>}
      </div>

      <Field label="Nom du client">
        <input className="input" autoFocus required maxLength={80} enterKeyHint="next" placeholder="Ex. Mamadou Diallo" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Logement">
          <select className="input" required value={unitId} onChange={(e) => { setUnitId(e.target.value); setNights(1) }}>
            <option value="">Choisir…</option>
            {units.map((u) => <option key={u.id} value={u.id} disabled={u.status === 'maintenance'}>{u.name}{u.status === 'maintenance' ? ' (maintenance)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Montant (FCFA)">
          <input className="input" type="number" inputMode="numeric" min="0" placeholder={byDefault > 0 ? String(byDefault) : ''} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>

      {picking && (
        <Field label="Jour d'arrivée">
          <input className="input" type="date" min={today()} value={start} onChange={(e) => { setStart(e.target.value); setNights(1) }} />
        </Field>
      )}

      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Courtier (facultatif)">
            <select className="input" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
              <option value="">Aucun</option>
              {brokers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          {brokerId && (
            <Field label="Commission du courtier (FCFA)">
              <input className="input" type="number" inputMode="numeric" min="0" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </Field>
          )}
        </div>
        {newBroker === null ? (
          <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={() => setNewBroker('')}>+ Nouveau courtier</button>
        ) : (
          <div className="flex gap-2">
            <input className="input" placeholder="Nom du courtier" value={newBroker} onChange={(e) => setNewBroker(e.target.value)} />
            <button type="button" className="btn btn-secondary" onClick={addBroker}>Ajouter</button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Combien de nuits ?</p>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-secondary !px-3" aria-label="Une nuit de moins" disabled={nights <= 1} onClick={() => setNights(nights - 1)}><Minus size={18} /></button>
          <span className="min-w-[6.5rem] text-center text-lg font-bold" aria-live="polite">{nights} nuit{nights > 1 ? 's' : ''}</span>
          <button type="button" className="btn btn-secondary !px-3" aria-label="Une nuit de plus" disabled={nights >= max} onClick={() => setNights(nights + 1)}><Plus size={18} /></button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Départ le {fdate(end)}{next && nights >= max ? ' · la nuit suivante est déjà réservée' : ''}</p>
      </div>

      <details className="group rounded-xl border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-salam-700">
          <span>Plus de détails <span className="font-normal text-slate-500">(tout est facultatif)</span></span>
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-slate-200 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prénom"><input className="input" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
            <Field label="Téléphone"><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="N° pièce d'identité"><input className="input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></Field>
            <Field label="Mode de paiement">
              <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
          </div>
          <Field label="Avance versée (FCFA)">
            <div className="flex gap-2">
              <input className="input" type="number" inputMode="numeric" min="0" placeholder="0" value={advance} onChange={(e) => setAdvance(e.target.value)} />
              <button type="button" className="btn btn-secondary whitespace-nowrap" disabled={!(total > 0)} onClick={() => setAdvance(String(total))}>Tout payé</button>
            </div>
          </Field>
          <Field label="Remarque">
            <input className="input" maxLength={80} placeholder="Ex. Carnet n° 71" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">Le téléphone et la pièce pourront être ajoutés plus tard, en modifiant la réservation.</p>
        </div>
      </details>

      <p className="rounded-xl bg-salam-50 p-3 text-sm">Total <b>{fcfa(total)}</b> · Reste à payer <b className="text-salam-700">{fcfa(total - Number(advance || 0))}</b></p>
      {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel}>Annuler</button>
      </div>
      {onMore && (
        <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={onMore}>
          Client déjà enregistré ? Ouvrir le formulaire complet
        </button>
      )}
    </form>
  )
}
