import { useState } from 'react'
import { Minus, Plus, ChevronDown } from 'lucide-react'
import { supabase } from './supabase'
import { PAY_MODES, NR, known, fcfa, addDays, nightsBetween, fdate, today, isJotted } from './utils'
import { Field, useNotify } from './ui'
import { longDate } from './calendar'

// Formulaire rapide, utilisé partout (planning, calendrier, accueil, page Réservations, proformas) :
// on ne voit que l'essentiel (nom du client, logement, montant, courtier facultatif, nuits).
// Tout le reste (prénom, téléphone, pièce d'identité, paiement, avance, remarque) est replié et facultatif.
//   - création : unit/date (case touchée) ou prefill (proforma)
//   - modification : booking (le client, ou le courtier qui bloque le logement, est complété)
export default function QuickBooking({ unit: unitProp, units = [], date, bookings, booking, prefill, brokers = [], reloadBrokers, onDone, onMore, onCancel }) {
  const { toast } = useNotify()
  const editing = Boolean(booking)
  const hasClient = editing && Boolean(booking.client_id)
  const jotted = editing && isJotted(booking) // texte écrit à la main sur le planning : il devient le nom du client
  const locked = editing && Boolean(booking.commission_paid_at) // commission déjà versée : courtier verrouillé
  const cl = booking?.clients
  const picking = !editing && !unitProp && !prefill?.unit_id // on choisit aussi le jour

  const [unitId, setUnitId] = useState(editing ? String(booking.unit_id) : unitProp ? String(unitProp.id) : prefill?.unit_id ? String(prefill.unit_id) : '')
  const [start, setStart] = useState(editing ? booking.check_in : prefill?.check_in || date || today())
  const [nights, setNights] = useState(editing ? booking.nights : prefill?.check_in && prefill?.check_out ? Math.max(1, nightsBetween(prefill.check_in, prefill.check_out)) : 1)
  const [name, setName] = useState(editing ? (hasClient ? cl?.last_name || '' : jotted ? booking.note || '' : '') : prefill?.last_name || '')
  // Montant : vide = calculé automatiquement avec le prix par nuit du logement (Réglages) ; une valeur saisie le remplace
  const [amount, setAmount] = useState(() => {
    if (!editing) return prefill?.total ? String(prefill.total) : ''
    const stored = Number(booking.total_amount)
    const auto = booking.nights * Number(units.find((u) => u.id === booking.unit_id)?.price_per_night || 0)
    return stored > 0 && stored !== auto ? String(stored) : ''
  })
  const [brokerId, setBrokerId] = useState(editing && booking.broker_id ? String(booking.broker_id) : '')
  const [commission, setCommission] = useState(editing && Number(booking.commission_amount) > 0 ? String(booking.commission_amount) : '')
  const [newBroker, setNewBroker] = useState(null) // null = fermé ; sinon le nom en cours de saisie
  // Détails repliés
  const [first, setFirst] = useState(editing ? cl?.first_name || '' : prefill?.first_name || '')
  const [phone, setPhone] = useState(editing ? (known(cl?.phone) ? cl.phone : '') : prefill?.phone || '')
  const [idNumber, setIdNumber] = useState(editing && known(cl?.id_number) ? cl.id_number : '')
  const [payMode, setPayMode] = useState(editing ? booking.payment_mode : PAY_MODES[0])
  const [advance, setAdvance] = useState(editing ? (Number(booking.advance) > 0 ? String(booking.advance) : '') : prefill?.advance && Number(prefill.advance) > 0 ? String(prefill.advance) : '')
  const [note, setNote] = useState(editing && !jotted ? booking.note || '' : '')
  // Les détails s'ouvrent d'eux-mêmes quand on complète un client auquel il manque le téléphone ou la pièce
  const [openDetails] = useState(editing && hasClient && (!known(cl?.phone) || !known(cl?.id_number)))
  const [created, setCreated] = useState(null) // évite un doublon client si la réservation échoue
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const unit = units.find((u) => String(u.id) === unitId)
  // Courtier choisi et nom du client laissé vide : on bloque seulement le logement pour ce courtier (ni client, ni prix)
  const isHold = !hasClient && Boolean(brokerId) && !name.trim()

  // On ne peut pas aller au-delà de la prochaine réservation du même logement
  const next = (bookings || [])
    .filter((b) => b.status !== 'annulee' && b.unit_id === unit?.id && b.id !== booking?.id && b.check_in > start)
    .map((b) => b.check_in)
    .sort()[0]
  const max = next ? nightsBetween(start, next) : 60
  const end = start ? addDays(start, nights) : ''
  const price = Number(unit?.price_per_night || 0)
  const byDefault = nights * price
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
    if (!isHold && !name.trim()) return setErr('Écrivez le nom du client, ou choisissez un courtier pour bloquer seulement le logement.')
    if (!unit) return setErr('Choisissez le logement.')
    if (!editing && (!start || start < today())) return setErr("Choisissez un jour à partir d'aujourd'hui.")
    if (!start) return setErr("Choisissez le jour d'arrivée.")
    if (!isHold && !(total >= 0)) return setErr('Le montant doit être un nombre positif.')
    const paid = isHold ? 0 : Number(advance || 0)
    if (paid > total) return setErr("L'avance ne peut pas dépasser le montant total.")
    const comm = brokerId && !isHold ? Number(commission || 0) : 0
    if (!locked && !isHold) {
      if (!(comm >= 0)) return setErr('La commission doit être un montant positif.')
      if (comm > total) return setErr('La commission ne peut pas dépasser le montant total.')
    }
    setBusy(true)

    // Seul le nom est obligatoire : le reste est « Non renseigné » en base, à compléter plus tard
    const row = { last_name: name.trim(), first_name: first.trim(), phone: phone.trim() || NR, id_number: idNumber.trim() || NR }
    let cid = created || (hasClient ? booking.client_id : null)
    if (isHold) {
      cid = null
    } else if (hasClient) {
      const old = cl || {}
      if (['last_name', 'first_name', 'phone', 'id_number'].some((k) => row[k] !== (old[k] ?? ''))) {
        const r = await supabase.from('clients').update(row).eq('id', booking.client_id)
        if (r.error) { setBusy(false); return setErr(r.error.message) }
      }
    } else if (!cid) {
      const r = await supabase.from('clients').insert(row).select().single()
      if (r.error) { setBusy(false); return setErr(r.error.message) }
      cid = r.data.id
      setCreated(cid)
    }

    const payload = isHold
      ? { unit_id: unit.id, check_in: start, check_out: end, payment_mode: PAY_MODES[0], total_amount: 0, advance: 0 }
      : { unit_id: unit.id, check_in: start, check_out: end, payment_mode: payMode, total_amount: total, advance: paid, note: note.trim() || null }
    if (!locked) {
      payload.broker_id = brokerId ? Number(brokerId) : null
      payload.commission_amount = comm
    }

    let error
    let savedId = booking?.id
    if (editing) {
      if (!hasClient && !isHold) payload.client_id = cid
      error = (await supabase.from('bookings').update(payload).eq('id', booking.id)).error
    } else {
      const ins = await supabase.from('bookings').insert({ client_id: cid, ...payload }).select('id').single()
      error = ins.error
      savedId = ins.data?.id
    }
    setBusy(false)
    if (error) {
      return setErr(
        error.code === '23P01' ? 'Ce logement est déjà pris sur ces dates.'
          : error.message.includes('commission') ? 'La commission ne peut pas dépasser le montant total.'
            : error.message,
      )
    }
    onDone(savedId, { hold: isHold })
  }

  const title = !editing ? (picking ? 'Écrire sur le planning' : 'Nouvelle réservation') : hasClient ? 'Modifier la réservation' : jotted ? 'Compléter la réservation' : 'Ajouter le client'

  return (
    <form onSubmit={submit} className="card space-y-4 !p-6">
      <div className="pr-10">
        {unit && <p className="text-sm font-semibold text-salam-700">{unit.name}</p>}
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
        {!picking && !editing && <p className="text-sm text-slate-500">À partir du {longDate(start)}</p>}
        {jotted && <p className="text-sm text-slate-500">Vous aviez écrit : « {booking.note} ». Vérifiez le nom et ajoutez le montant.</p>}
        {editing && !hasClient && !jotted && <p className="text-sm text-slate-500">Le logement est gardé pour {booking.broker_name || 'le courtier'}. Indiquez le client et le montant.</p>}
        {!editing && prefill && <p className="text-sm text-slate-500">Informations reprises du proforma.</p>}
      </div>

      <Field label="Nom du client" hint={brokerId && !hasClient ? 'Laissez vide pour bloquer seulement le logement pour ce courtier.' : undefined}>
        <input className="input" autoFocus={!editing} required={!brokerId || hasClient} maxLength={80} enterKeyHint="next" placeholder="Ex. Mamadou Diallo" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Logement">
          <select className="input" required value={unitId} onChange={(e) => { setUnitId(e.target.value); setNights(1) }}>
            <option value="">Choisir…</option>
            {units.map((u) => <option key={u.id} value={u.id} disabled={u.status === 'maintenance' && String(u.id) !== unitId}>{u.name}{u.status === 'maintenance' ? ' (maintenance)' : ''}</option>)}
          </select>
        </Field>
        {!isHold && (
          <Field
            label="Montant (FCFA)"
            hint={!unit ? undefined
              : amount === '' ? (price > 0 ? `Prix du logement : ${fcfa(price)} × ${nights} nuit${nights > 1 ? 's' : ''}` : 'Prix par nuit pas encore réglé pour ce logement (Réglages)')
                : price > 0 && Number(amount) !== byDefault ? `Prix modifié (tarif du logement : ${fcfa(byDefault)})` : undefined}
          >
            <input className="input" type="number" inputMode="numeric" min="0" value={amount !== '' ? amount : byDefault > 0 ? String(byDefault) : ''} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}
      </div>

      {(picking || editing || prefill) && (
        <Field label="Jour d'arrivée">
          <input className="input" type="date" min={editing ? undefined : today()} value={start} onChange={(e) => { setStart(e.target.value); setNights(1) }} />
        </Field>
      )}

      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 p-3">
        {locked ? (
          <p className="text-sm text-slate-600">
            Commission de {fcfa(booking.commission_amount)} déjà versée à {booking.broker_name || 'un courtier'}. Pour la modifier, annulez d'abord le versement dans l'onglet Courtiers.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Courtier (facultatif)" hint={!hasClient && !brokerId ? "Il bloque un logement ? Choisissez-le et laissez le nom du client vide." : undefined}>
                <select className="input" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
                  <option value="">Aucun</option>
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

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Combien de nuits ?</p>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-secondary !px-3" aria-label="Une nuit de moins" disabled={nights <= 1} onClick={() => setNights(nights - 1)}><Minus size={18} /></button>
          <span className="min-w-[6.5rem] text-center text-lg font-bold" aria-live="polite">{nights} nuit{nights > 1 ? 's' : ''}</span>
          <button type="button" className="btn btn-secondary !px-3" aria-label="Une nuit de plus" disabled={nights >= max} onClick={() => setNights(nights + 1)}><Plus size={18} /></button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Départ le {fdate(end)}{next && nights >= max ? ' · la nuit suivante est déjà réservée' : ''}</p>
      </div>

      {!isHold && (
      <details open={openDetails} className="group rounded-xl border border-slate-200 bg-slate-50">
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
      )}

      {isHold ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Le logement sera <b>gardé</b> pour le courtier du {longDate(start)} ({nights} nuit{nights > 1 ? 's' : ''}). Aucun montant à saisir pour l'instant : vous noterez le client et le prix quand il sera connu (bouton « Ajouter le client »).
        </p>
      ) : (
        <p className="rounded-xl bg-salam-50 p-3 text-sm">Total <b>{fcfa(total)}</b> · Reste à payer <b className="text-salam-700">{fcfa(total - Number(advance || 0))}</b></p>
      )}
      {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Enregistrement…' : isHold ? 'Bloquer le logement' : 'Enregistrer'}</button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel}>Annuler</button>
      </div>
      {onMore && !editing && (
        <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={onMore}>
          Client déjà enregistré ? Ouvrir le formulaire complet
        </button>
      )}
    </form>
  )
}
