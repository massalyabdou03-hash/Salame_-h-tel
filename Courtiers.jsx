import { useState } from 'react'
import { Handshake, Check, Undo2 } from 'lucide-react'
import { supabase } from './supabase'
import { fcfa, fdate } from './utils'

// Les heures sont affichées à l'heure de Dakar, quelle que soit l'heure réglée sur l'ordinateur
const DAKAR = { timeZone: 'Africa/Dakar' }
const dDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', DAKAR)
const dTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { ...DAKAR, hour: '2-digit', minute: '2-digit' })
const dMonth = (ts) => new Date(ts).toLocaleDateString('sv-SE', DAKAR).slice(0, 7)

const sum = (rows) => rows.reduce((s, b) => s + Number(b.commission_amount), 0)
const pct = (b) => (Number(b.total_amount) > 0 ? Math.round((Number(b.commission_amount) / Number(b.total_amount)) * 100) : 0)

export default function Courtiers({ data, reload }) {
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
    if (!n) return setErr('Saisissez le nom du courtier.')
    setBusy(true)
    const { error } = await supabase.from('brokers').insert({ name: n, phone: phone.trim() || null })
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'Ce courtier existe déjà.' : `Échec de l'enregistrement : ${error.message}`)
    setName(''); setPhone('')
    reload()
  }

  // L'heure du versement est fixée par le serveur (pas par l'ordinateur)
  const setPaid = async (b, paidNow) => {
    const text = paidNow
      ? `Confirmer le versement de ${fcfa(b.commission_amount)} à ${nameOf[b.broker_id]} ?`
      : 'Annuler ce versement ?'
    if (!confirm(text)) return
    setBusyId(b.id)
    const { error } = await supabase.from('bookings').update({ commission_paid_at: paidNow ? new Date().toISOString() : null }).eq('id', b.id)
    setBusyId(null)
    if (error) return alert(error.message)
    reload()
  }

  const kpis = [
    ['Commissions gagnées', earned, 'text-slate-900'],
    ['Déjà versé', paid, 'text-salam-700'],
    ['Reste à verser', rest, rest > 0 ? 'text-amber-700' : 'text-salam-700'],
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {kpis.map(([label, value, color], i) => (
          <div key={label} className={`card ${i === 2 ? 'col-span-2 md:col-span-1' : ''}`}>
            <Handshake size={18} className={color} />
            <p className="mt-2 text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{fcfa(value)}</p>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="card space-y-3">
        <h2 className="font-bold">Ajouter un courtier</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Nom</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Téléphone (facultatif)</span>
            <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        </div>
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Ajouter le courtier'}</button>
      </form>

      <h2 className="pt-2 font-bold">Courtiers</h2>
      <ul className="space-y-3">
        {brokers.length === 0 && (
          <li className="card text-sm text-slate-500">Aucun courtier pour l'instant. Ajoutez-en un ci-dessus, ou directement dans une réservation.</li>
        )}
        {brokers.map((br) => {
          const st = statsOf(br.id)
          const rows = withComm.filter((b) => b.broker_id === br.id)
          return (
            <li key={br.id} className="card space-y-3">
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
                      <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
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

      <h2 className="pt-2 font-bold">Historique des versements</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Mois</span>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <p className="ml-auto text-sm">Total versé : <b className="text-lg text-red-700">{fcfa(sum(history))}</b></p>
      </div>
      <ul className="space-y-2">
        {history.length === 0 && <li className="card text-sm text-slate-500">Aucun versement enregistré.</li>}
        {history.map((b) => (
          <li key={b.id} className="card flex items-start gap-3 p-3 text-sm">
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
    </>
  )
}
