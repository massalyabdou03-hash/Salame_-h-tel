import { useState } from 'react'
import { supabase } from './supabase'
import { PAY_MODES, fcfa, today, addDays, nightsBetween } from './utils'

const Field = ({ label, children }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>
)

export default function BookingForm({ booking, units, clients, onDone, onCancel }) {
  const editing = Boolean(booking)
  const [isNew, setIsNew] = useState(!editing && clients.length === 0)
  const [clientId, setClientId] = useState('')
  const [created, setCreated] = useState(null) // évite un doublon client si la réservation échoue
  const [c, setC] = useState({ last_name: '', first_name: '', phone: '', id_number: '' })
  const [f, setF] = useState(editing
    ? { unit_id: String(booking.unit_id), check_in: booking.check_in, check_out: booking.check_out, payment_mode: booking.payment_mode, advance: String(booking.advance), total: String(booking.total_amount) }
    : { unit_id: '', check_in: today(), check_out: addDays(today(), 1), payment_mode: PAY_MODES[0], advance: '0', total: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setClient = (k) => (e) => setC({ ...c, [k]: e.target.value })

  const unit = units.find((u) => String(u.id) === f.unit_id)
  const nights = nightsBetween(f.check_in, f.check_out)
  const total = f.total !== '' ? Number(f.total) : nights * Number(unit?.price_per_night || 0)
  const balance = total - Number(f.advance || 0)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (nights < 1) return setErr("La date de départ doit être après la date d'arrivée.")
    if (balance < 0) return setErr("L'avance ne peut pas dépasser le montant total.")
    setBusy(true)

    const payload = {
      unit_id: Number(f.unit_id), check_in: f.check_in, check_out: f.check_out,
      payment_mode: f.payment_mode, advance: Number(f.advance || 0), total_amount: total,
    }

    let error
    if (editing) {
      ({ error } = await supabase.from('bookings').update(payload).eq('id', booking.id))
    } else {
      let cid = isNew ? created : clientId
      if (isNew && !cid) {
        const r = await supabase.from('clients').insert(c).select().single()
        if (r.error) { setBusy(false); return setErr(r.error.message) }
        cid = r.data.id
        setCreated(cid)
      }
      ({ error } = await supabase.from('bookings').insert({ client_id: cid, ...payload }))
    }

    setBusy(false)
    if (error) return setErr(error.code === '23P01' ? 'Ce logement est déjà réservé sur ces dates.' : error.message)
    onDone()
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{editing ? 'Modifier la réservation' : 'Nouvelle réservation'}</h2>
        {!editing && clients.length > 0 && (
          <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={() => setIsNew(!isNew)}>
            {isNew ? 'Choisir un client existant' : 'Nouveau client'}
          </button>
        )}
      </div>

      {editing ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm">Client : <b>{booking.clients.first_name} {booking.clients.last_name}</b> — {booking.clients.phone}</p>
      ) : isNew ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom"><input className="input" required value={c.last_name} onChange={setClient('last_name')} /></Field>
          <Field label="Prénom"><input className="input" required value={c.first_name} onChange={setClient('first_name')} /></Field>
          <Field label="Téléphone"><input className="input" type="tel" required value={c.phone} onChange={setClient('phone')} /></Field>
          <Field label="N° pièce d'identité"><input className="input" required value={c.id_number} onChange={setClient('id_number')} /></Field>
        </div>
      ) : (
        <Field label="Client">
          <select className="input" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sélectionner…</option>
            {clients.map((x) => <option key={x.id} value={x.id}>{x.last_name} {x.first_name} — {x.phone}</option>)}
          </select>
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Logement">
          <select className="input" required value={f.unit_id} onChange={set('unit_id')}>
            <option value="">Sélectionner…</option>
            {units.map((u) => <option key={u.id} value={u.id} disabled={u.status === 'maintenance'}>{u.name} — {u.type}{u.status === 'maintenance' ? ' (maintenance)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Arrivée"><input className="input" type="date" required value={f.check_in} onChange={set('check_in')} /></Field>
        <Field label="Départ"><input className="input" type="date" required value={f.check_out} onChange={set('check_out')} /></Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mode de paiement">
          <select className="input" value={f.payment_mode} onChange={set('payment_mode')}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field label={`Montant total (${nights} nuit${nights > 1 ? 's' : ''})`}>
          <input className="input" type="number" min="0" placeholder={String(nights * Number(unit?.price_per_night || 0))} value={f.total} onChange={set('total')} />
        </Field>
        <Field label="Avance versée"><input className="input" type="number" min="0" value={f.advance} onChange={set('advance')} /></Field>
      </div>

      <p className="rounded-lg bg-salam-50 p-3 text-sm">Total <b>{fcfa(total)}</b> · Solde à payer <b className="text-salam-700">{fcfa(balance)}</b></p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer la réservation'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}
