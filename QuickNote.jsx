import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { supabase } from './supabase'
import { PAY_MODES, addDays, nightsBetween, fdate, today } from './utils'
import { longDate } from './calendar'

// Écriture directe sur le planning : on appuie sur une case vide, on écrit quelques mots
// (nom du client, du courtier, une remarque), on choisit le nombre de nuits, et c'est noté.
// Les détails (client, prix) se complètent plus tard.
export default function QuickNote({ unit: unitProp, units = [], date, bookings, booking, onDone, onMore, onCancel }) {
  const editing = Boolean(booking)
  // Sans case touchée (bouton « Écrire sur le planning »), on choisit le logement et le jour ici
  const picking = !unitProp && !editing
  const [pickUnit, setPickUnit] = useState('')
  const [pickDate, setPickDate] = useState(date || today())
  const unit = picking ? units.find((u) => String(u.id) === pickUnit) : unitProp
  const start = editing ? booking.check_in : picking ? pickDate : date
  const [text, setText] = useState(editing ? booking.note || '' : '')
  const [nights, setNights] = useState(editing ? booking.nights : 1)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // On ne peut pas aller au-delà de la prochaine réservation du même logement
  const next = bookings
    .filter((b) => b.status !== 'annulee' && b.unit_id === unit?.id && b.id !== booking?.id && b.check_in > start)
    .map((b) => b.check_in)
    .sort()[0]
  const max = next ? nightsBetween(start, next) : 60
  const end = start ? addDays(start, nights) : ''

  const submit = async (e) => {
    e.preventDefault()
    const note = text.trim()
    if (!unit) return setErr('Choisissez le logement.')
    if (!start || start < today()) return setErr('Choisissez un jour à partir d\'aujourd\'hui.')
    if (!note) return setErr('Écrivez quelques mots : un nom, un courtier, une remarque…')
    setErr('')
    setBusy(true)
    const res = editing
      ? await supabase.from('bookings').update({ note, check_out: end }).eq('id', booking.id)
      : await supabase.from('bookings').insert({
          unit_id: unit.id, client_id: null, broker_id: null, check_in: start, check_out: end,
          payment_mode: PAY_MODES[0], total_amount: 0, advance: 0, commission_amount: 0, note,
        })
    setBusy(false)
    if (res.error) {
      const m = res.error.message || ''
      return setErr(
        res.error.code === '23P01' ? 'Ce logement est déjà pris sur ces dates.'
          : m.includes('client_or_broker') ? "L'écriture directe demande une petite mise à jour de la base de données (voir Massaly)."
            : m,
      )
    }
    onDone(editing)
  }

  return (
    <form onSubmit={submit} className="card space-y-4 !p-6">
      <div className="pr-10">
        {unit && <p className="text-sm font-semibold text-salam-700">{unit.name}</p>}
        <h2 className="text-lg font-extrabold text-slate-900">{editing ? 'Modifier ce qui est écrit' : picking ? 'Écrire sur le planning' : 'Écrire sur cette date'}</h2>
        {!picking && <p className="text-sm text-slate-500">À partir du {longDate(start)}</p>}
      </div>

      {picking && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Logement</span>
            <select className="input" value={pickUnit} onChange={(e) => { setPickUnit(e.target.value); setNights(1) }}>
              <option value="">Choisir…</option>
              {units.map((u) => <option key={u.id} value={u.id} disabled={u.status === 'maintenance'}>{u.name}{u.status === 'maintenance' ? ' (maintenance)' : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Jour d'arrivée</span>
            <input className="input" type="date" min={today()} value={pickDate} onChange={(e) => { setPickDate(e.target.value); setNights(1) }} />
          </label>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Écrivez ici</span>
        <input
          className="input"
          autoFocus={!picking}
          maxLength={80}
          enterKeyHint="done"
          placeholder="Ex. Mamadou Diallo, ou courtier Awa"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Combien de nuits ?</p>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-secondary !px-3" aria-label="Une nuit de moins" disabled={nights <= 1} onClick={() => setNights(nights - 1)}><Minus size={18} /></button>
          <span className="min-w-[6.5rem] text-center text-lg font-bold" aria-live="polite">{nights} nuit{nights > 1 ? 's' : ''}</span>
          <button type="button" className="btn btn-secondary !px-3" aria-label="Une nuit de plus" disabled={nights >= max} onClick={() => setNights(nights + 1)}><Plus size={18} /></button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Départ le {fdate(end)}{next && nights >= max ? ' · la nuit suivante est déjà réservée' : ''}</p>
      </div>

      {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel}>Annuler</button>
      </div>
      {!editing && !picking && (
        <button type="button" className="text-sm font-medium text-salam-700 underline" onClick={onMore}>
          Plus de détails (client, prix, courtier…)
        </button>
      )}
    </form>
  )
}
