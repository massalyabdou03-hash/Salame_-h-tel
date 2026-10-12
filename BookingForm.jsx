import { useState } from 'react'
import { supabase } from './supabase'
import { PAY_MODES, fcfa, today, addDays, nightsBetween } from './utils'
import { Field, useNotify } from './ui'
import { longDate } from './calendar'

// Deux grands boutons pour choisir (un seul est actif)
const Choice = ({ options, value, onChange, label }) => (
  <div role="group" aria-label={label} className="grid gap-2 sm:grid-cols-2">
    {options.map(([id, text, hint]) => (
      <button
        key={String(id)}
        type="button"
        aria-pressed={value === id}
        onClick={() => onChange(id)}
        className={`rounded-xl border-2 px-4 py-3 text-left transition ${value === id ? 'border-salam-600 bg-salam-50 ring-1 ring-salam-600/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}
      >
        <span className="block text-[15px] font-bold text-slate-900">{text}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </button>
    ))}
  </div>
)

export default function BookingForm({ booking, initialDate, initialUnit, prefill, units, clients, brokers = [], reloadBrokers, onDone, onCancel }) {
  const { toast } = useNotify()
  const editing = Boolean(booking)
  // Réservation « bloquée » par un courtier (pas encore de client) que l'on complète
  const holdEdit = editing && !booking.client_id
  const choosingClient = !editing || holdEdit
  const startDay = !editing && initialDate ? initialDate : today()
  // Si un client existant a le même téléphone que le proforma, on le sélectionne ; sinon nouveau client prérempli
  const digits = (x) => String(x ?? '').replace(/\D/g, '')
  const known = !editing && prefill?.phone ? clients.find((x) => digits(x.phone) && digits(x.phone) === digits(prefill.phone)) : null
  const [isNew, setIsNew] = useState(choosingClient && (clients.length === 0 || (Boolean(prefill) && !known)))
  const [clientId, setClientId] = useState(known ? known.id : '')
  const [created, setCreated] = useState(null) // évite un doublon client si la réservation échoue
  const [c, setC] = useState({ last_name: prefill?.last_name || '', first_name: prefill?.first_name || '', phone: prefill?.phone || '', id_number: '' })
  const [f, setF] = useState(editing
    ? { unit_id: String(booking.unit_id), check_in: booking.check_in, check_out: booking.check_out, payment_mode: booking.payment_mode, advance: String(booking.advance), total: holdEdit ? '' : String(booking.total_amount) }
    : prefill
      ? { unit_id: prefill.unit_id || '', check_in: prefill.check_in, check_out: prefill.check_out, payment_mode: PAY_MODES[0], advance: prefill.advance || '0', total: prefill.total || '' }
      : { unit_id: initialUnit ? String(initialUnit) : '', check_in: startDay, check_out: addDays(startDay, 1), payment_mode: PAY_MODES[0], advance: '0', total: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // Courtier. Si la commission est déjà versée, ces champs sont verrouillés.
  const locked = editing && Boolean(booking.commission_paid_at)
  const [brokerId, setBrokerId] = useState(editing && booking.broker_id ? String(booking.broker_id) : '')
  const [commission, setCommission] = useState(editing && Number(booking.commission_amount) > 0 ? String(booking.commission_amount) : '')
  const [newBroker, setNewBroker] = useState(null) // null = fermé ; sinon le nom en cours de saisie
  // Ancienne réservation : déjà terminée, saisie seulement pour compléter l'historique
  const [legacy, setLegacy] = useState(false)
  const [note, setNote] = useState(editing ? booking.note || '' : '')
  const isLegacy = editing ? Boolean(booking.legacy) : legacy
  // Qui réserve ? Client direct ou courtier (avec ou sans client connu)
  const [source, setSource] = useState(holdEdit && booking.broker_id ? 'courtier' : 'direct')
  const [clientKnown, setClientKnown] = useState(!holdEdit)
  const showSource = choosingClient && !isLegacy
  const viaBroker = showSource ? source === 'courtier' : true
  const isHold = showSource && source === 'courtier' && !clientKnown

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setClient = (k) => (e) => setC({ ...c, [k]: e.target.value })

  const toggleLegacy = (e) => {
    const on = e.target.checked
    setLegacy(on)
    if (on) { setSource('direct'); setClientKnown(true) }
    // Une ancienne réservation est terminée : on propose hier → aujourd'hui
    setF({ ...f, check_in: on ? addDays(today(), -1) : startDay, check_out: on ? today() : addDays(startDay, 1) })
  }

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

  const unit = units.find((u) => String(u.id) === f.unit_id)
  const nights = nightsBetween(f.check_in, f.check_out)
  const total = f.total !== '' ? Number(f.total) : nights * Number(unit?.price_per_night || 0)
  const balance = total - Number(f.advance || 0)
  const effBroker = viaBroker ? brokerId : ''

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (nights < 1) return setErr("La date de départ doit être après la date d'arrivée.")

    if (isHold) {
      if (!brokerId) return setErr('Choisissez le courtier qui bloque le logement.')
    } else {
      if (balance < 0) return setErr("L'avance ne peut pas dépasser le montant total.")
      if (showSource && source === 'courtier' && !brokerId) return setErr('Choisissez le courtier.')
    }

    if (isLegacy) {
      if (f.check_out > today()) return setErr("Une ancienne réservation doit être terminée : la date de départ ne peut pas être après aujourd'hui.")
      if (!(total > 0)) return setErr('Indiquez le montant total de cette ancienne réservation.')
    }

    const comm = isHold || isLegacy ? 0 : locked ? Number(booking.commission_amount) : Number(commission || 0)
    if (!locked && !isLegacy && !isHold) {
      if (!(comm >= 0)) return setErr('La commission doit être un montant positif.')
      if (comm > 0 && !effBroker) return setErr('Choisissez le courtier pour cette commission.')
      if (comm > total) return setErr('La commission ne peut pas dépasser le montant total.')
    }
    setBusy(true)

    const payload = {
      unit_id: Number(f.unit_id), check_in: f.check_in, check_out: f.check_out,
      payment_mode: isHold ? PAY_MODES[0] : f.payment_mode,
      advance: isHold ? 0 : Number(f.advance || 0),
      total_amount: isHold ? 0 : total,
    }
    if (!locked && !isLegacy) {
      payload.broker_id = effBroker ? Number(effBroker) : null
      payload.commission_amount = effBroker ? comm : 0
    }
    if (isLegacy) payload.note = note.trim() || null
    if (isLegacy && !editing) {
      payload.legacy = true
      payload.created_at = `${f.check_in}T12:00:00Z` // pas d'effet sur l'historique d'aujourd'hui
    }

    // Client : pas de client pour un logement bloqué ; sinon choisi ou créé maintenant
    let cid = null
    if (choosingClient && !isHold) {
      cid = isNew ? created : clientId
      if (isNew && !cid) {
        const row = isLegacy ? { ...c, phone: c.phone.trim() || 'Non renseigné', id_number: c.id_number.trim() || 'Non renseigné' } : c
        const r = await supabase.from('clients').insert(row).select().single()
        if (r.error) { setBusy(false); return setErr(r.error.message) }
        cid = r.data.id
        setCreated(cid)
      }
    }

    let error
    let savedId = booking?.id
    if (editing) {
      if (holdEdit && cid) payload.client_id = cid
      const upd = await supabase.from('bookings').update(payload).eq('id', booking.id)
      error = upd.error
    } else {
      const ins = await supabase.from('bookings').insert({ client_id: cid, ...payload }).select('id').single()
      error = ins.error
      savedId = ins.data?.id
    }

    setBusy(false)
    if (error) return setErr(error.code === '23P01' ? 'Ce logement est déjà réservé sur ces dates.' : error.message.includes('commission') ? 'La commission ne peut pas dépasser le montant total.' : error.message.includes('client_or_broker') ? 'Il faut un client ou un courtier pour réserver.' : error.message)
    onDone(savedId, { hold: isHold })
  }

  const jotted = holdEdit && !booking.broker_id
  const title = jotted ? 'Compléter la réservation' : holdEdit ? 'Logement bloqué par un courtier' : editing ? 'Modifier la réservation' : 'Nouvelle réservation'

  return (
    <form onSubmit={submit} className="card space-y-5 border-salam-600/40 !p-6 ring-1 ring-salam-600/10">
      <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {jotted && <p className="text-sm text-slate-500">Vous aviez écrit : « {booking.note} ». Indiquez maintenant le client et les prix.</p>}
          {holdEdit && !jotted && <p className="text-sm text-slate-500">Quand vous connaissez le client, choisissez « Je connais le client » pour l'ajouter.</p>}
          {!editing && initialDate && <p className="text-sm text-slate-500">Arrivée prévue le {longDate(initialDate)}{unit ? ` · ${unit.name}` : ''}</p>}
          {!editing && prefill && <p className="text-sm text-slate-500">Informations reprises du proforma. Complétez la pièce d'identité du client si besoin.</p>}
        </div>
      </div>

      {showSource && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Qui réserve ?</p>
          <Choice
            label="Qui réserve"
            value={source}
            onChange={(v) => { setSource(v); if (v === 'direct') setClientKnown(true) }}
            options={[['direct', 'Le client lui-même', 'Client direct, sans courtier'], ['courtier', 'Un courtier', 'Il amène un client ou bloque un logement']]}
          />
          {source === 'courtier' && (
            <>
              <Choice
                label="Le client est-il connu ?"
                value={clientKnown}
                onChange={setClientKnown}
                options={[[true, 'Je connais le client', 'Je note son nom maintenant'], [false, 'Pas encore de client', 'Je bloque seulement le logement']]}
              />
            </>
          )}
        </div>
      )}

      {viaBroker && !isLegacy && (showSource ? source === 'courtier' : true) && (
        <div className={`space-y-3 rounded-xl border border-dashed p-3 ${showSource ? 'border-gold/60 bg-amber-50/40' : 'border-slate-300'}`}>
          {!showSource && <p className="text-sm font-medium text-slate-700">Courtier <span className="font-normal text-slate-500">(facultatif)</span></p>}
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
                    <option value="">{showSource ? 'Choisir…' : 'Aucun'}</option>
                    {brokers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    {brokerId && !brokers.some((x) => String(x.id) === brokerId) && <option value={brokerId}>{booking?.broker_name || 'Courtier'} (retiré de la liste)</option>}
                  </select>
                </Field>
                {brokerId && !isHold && (
                  <Field label="Commission du courtier (FCFA)">
                    <input className="input" type="number" inputMode="numeric" min="0" value={commission} onChange={(e) => setCommission(e.target.value)} />
                  </Field>
                )}
              </div>
              {brokerId && !isHold && Number(commission) > 0 && total > 0 && (
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
      )}

      {editing && !holdEdit ? (
        <p className="rounded-lg bg-slate-50 p-3 text-sm">Client : <b>{booking.clients.first_name} {booking.clients.last_name}</b> — {booking.clients.phone}</p>
      ) : isHold ? null : (
        <div className="space-y-3">
          {clients.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">{isNew ? 'Nouveau client' : ''}</p>
              <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={() => setIsNew(!isNew)}>
                {isNew ? 'Choisir un client existant' : 'Nouveau client'}
              </button>
            </div>
          )}
          {isNew ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom"><input className="input" required value={c.last_name} onChange={setClient('last_name')} /></Field>
              <Field label="Prénom"><input className="input" required value={c.first_name} onChange={setClient('first_name')} /></Field>
              <Field label="Téléphone"><input className="input" type="tel" required={!isLegacy} value={c.phone} onChange={setClient('phone')} /></Field>
              <Field label="N° pièce d'identité"><input className="input" required={!isLegacy} value={c.id_number} onChange={setClient('id_number')} /></Field>
            </div>
          ) : (
            <Field label="Client">
              <select className="input" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Choisir…</option>
                {clients.map((x) => <option key={x.id} value={x.id}>{x.last_name} {x.first_name} — {x.phone}</option>)}
              </select>
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Logement">
          <select className="input" required value={f.unit_id} onChange={set('unit_id')}>
            <option value="">Choisir…</option>
            {units.map((u) => <option key={u.id} value={u.id} disabled={u.status === 'maintenance' && !isLegacy}>{u.name} — {u.type}{u.status === 'maintenance' ? ' (maintenance)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Date d'arrivée"><input className="input" type="date" required value={f.check_in} onChange={set('check_in')} /></Field>
        <Field label="Date de départ"><input className="input" type="date" required value={f.check_out} onChange={set('check_out')} /></Field>
      </div>

      {isHold ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Le logement sera <b>gardé</b> pour le courtier du {f.check_in ? longDate(f.check_in) : '…'} ({nights} nuit{nights > 1 ? 's' : ''}). Aucun prix à saisir pour l'instant : vous les noterez quand le client sera connu.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Mode de paiement">
            <select className="input" value={f.payment_mode} onChange={set('payment_mode')}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <Field label={`Montant total (${nights} nuit${nights > 1 ? 's' : ''})`}>
            <input className="input" type="number" min="0" placeholder={String(nights * Number(unit?.price_per_night || 0))} value={f.total} onChange={set('total')} />
          </Field>
          <Field label="Avance versée"><input className="input" type="number" min="0" value={f.advance} onChange={set('advance')} /></Field>
        </div>
      )}

      {!editing && source === 'direct' && (
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={legacy} onChange={toggleLegacy} />
          <span>
            <b>Ancienne réservation</b> (déjà terminée, pour compléter l'historique)
            <span className="block text-xs text-slate-500">Téléphone et pièce d'identité facultatifs. Aucune facture ni contrat n'est créé : la facture papier existe déjà.</span>
          </span>
        </label>
      )}

      {isLegacy && (
        <div className="space-y-2">
          <Field label="N° du carnet ou remarque (facultatif)">
            <input className="input" placeholder="Ex. Carnet n° 71" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">Indiquez dans « Avance versée » le montant déjà payé (en général le total). Un reste à payer serait compté dans les soldes à encaisser.</p>
        </div>
      )}

      {!isHold && <p className="rounded-xl bg-salam-50 p-3 text-sm">Total <b>{fcfa(total)}</b> · Reste à payer <b className="text-salam-700">{fcfa(balance)}</b></p>}
      {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Enregistrement…' : isHold ? 'Bloquer le logement' : editing ? 'Enregistrer les modifications' : 'Enregistrer la réservation'}
        </button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}
