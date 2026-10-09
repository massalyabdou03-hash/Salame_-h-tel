import { useState } from 'react'
import { supabase } from './supabase'
import { PAY_MODES, fcfa, today, addDays, nightsBetween } from './utils'

const Field = ({ label, children }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>
)

export default function BookingForm({ booking, units, clients, brokers = [], reloadBrokers, onDone, onCancel }) {
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
  // Courtier (facultatif). Si la commission est déjà versée, ces champs sont verrouillés.
  const locked = editing && Boolean(booking.commission_paid_at)
  const [brokerId, setBrokerId] = useState(editing && booking.broker_id ? String(booking.broker_id) : '')
  const [commission, setCommission] = useState(editing && Number(booking.commission_amount) > 0 ? String(booking.commission_amount) : '')
  const [newBroker, setNewBroker] = useState(null) // null = fermé ; sinon le nom en cours de saisie

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setClient = (k) => (e) => setC({ ...c, [k]: e.target.value })

  const addBroker = async () => {
    const n = (newBroker || '').trim()
    if (!n) return setErr('Saisissez le nom du courtier.')
    setErr('')
    const r = await supabase.from('brokers').insert({ name: n }).select().single()
    if (r.error) return setErr(r.error.code === '23505' ? 'Ce courtier existe déjà dans la liste.' : r.error.message)
    setBrokerId(String(r.data.id))
    setNewBroker(null)
    reloadBrokers?.()
  }

  const unit = units.find((u) => String(u.id) === f.unit_id)
  const nights = nightsBetween(f.check_in, f.check_out)
  const total = f.total !== '' ? Number(f.total) : nights * Number(unit?.price_per_night || 0)
  const balance = total - Number(f.advance || 0)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (nights < 1) return setErr("La date de départ doit être après la date d'arrivée.")
    if (balance < 0) return setErr("L'avance ne peut pas dépasser le montant total.")

    const comm = locked ? Number(booking.commission_amount) : Number(commission || 0)
    if (!locked) {
      if (!(comm >= 0)) return setErr('La commission doit être un montant positif.')
      if (comm > 0 && !brokerId) return setErr('Choisissez le courtier pour cette commission.')
      if (comm > total) return setErr('La commission ne peut pas dépasser le montant total.')
    }
    setBusy(true)

    const payload = {
      unit_id: Number(f.unit_id), check_in: f.check_in, check_out: f.check_out,
      payment_mode: f.payment_mode, advance: Number(f.advance || 0), total_amount: total,
    }
    if (!locked) {
      payload.broker_id = brokerId ? Number(brokerId) : null
      payload.commission_amount = brokerId ? comm : 0
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
    if (error) return setErr(error.code === '23P01' ? 'Ce logement est déjà réservé sur ces dates.' : error.message.includes('commission') ? 'La commission ne peut pas dépasser le montant total.' : error.message)
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

      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-3">
        <p className="text-sm font-medium text-slate-700">Courtier <span className="font-normal text-slate-500">(facultatif)</span></p>
        {locked ? (
          <p className="text-sm text-slate-600">
            Commission de {fcfa(booking.commission_amount)} déjà versée le {new Date(booking.commission_paid_at).toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })}.
            Pour la modifier, annulez d'abord le versement dans l'onglet Courtiers.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Courtier">
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
            {brokerId && Number(commission) > 0 && total > 0 && (
              <p className="text-xs text-slate-500">Cela représente environ {Math.round((Number(commission) / total) * 100)} % du montant total.</p>
            )}
            {newBroker === null ? (
              <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={() => setNewBroker('')}>+ Nouveau courtier</button>
            ) : (
              <div className="flex gap-2">
                <input className="input" placeholder="Nom du courtier" value={newBroker} onChange={(e) => setNewBroker(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={addBroker}>Ajouter</button>
              </div>
            )}
          </>
        )}
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
