import { useState } from 'react'
import { Wallet, TrendingDown, PiggyBank, BedDouble, Banknote, Wrench, LogIn, LogOut, CalendarPlus } from 'lucide-react'
import { supabase } from './supabase'
import { fcfa, fdate, today, addDays, isActive, stageOf, STAGE } from './utils'

const BADGE = { occupe: 'bg-red-100 text-red-800', disponible: 'bg-emerald-100 text-emerald-800', maintenance: 'bg-amber-100 text-amber-800' }
const LABEL = { occupe: 'Occupé', disponible: 'Disponible', maintenance: 'En maintenance' }

function TodayList({ title, Icon, rows }) {
  return (
    <div className="card">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon size={16} className="text-salam-600" />{title} ({rows.length})</h3>
      {rows.length === 0 && <p className="text-sm text-slate-500">Aucun.</p>}
      {rows.map((b) => {
        const rest = Number(b.total_amount) - Number(b.advance)
        return (
          <p key={b.id} className="text-sm">
            <b>{b.units.name}</b> — {b.clients.first_name} {b.clients.last_name}
            {rest > 0 && <span className="text-red-700"> · reste {fcfa(rest)}</span>}
          </p>
        )
      })}
    </div>
  )
}

function Planning({ units, bookings }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i))
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-2 text-left">Logement</th>
            {days.map((d) => <th key={d} className="p-1 font-medium text-slate-500">{d.slice(8)}</th>)}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="sticky left-0 whitespace-nowrap bg-white p-2 font-medium">{u.name}</td>
              {days.map((d) => {
                const b = bookings.find((x) => x.unit_id === u.id && isActive(x, d))
                return (
                  <td
                    key={d}
                    title={b ? `${b.clients?.first_name} ${b.clients?.last_name}` : ''}
                    className={`h-7 min-w-6 border-l ${b ? 'bg-salam-600' : u.status === 'maintenance' ? 'bg-amber-200' : ''}`}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Historique ----------
// Les heures sont affichées à l'heure de Dakar, quelle que soit l'heure réglée sur l'ordinateur
const DAKAR = { timeZone: 'Africa/Dakar' }
const dakarDay = (ts) => new Date(ts).toLocaleDateString('sv-SE', DAKAR)
const dakarDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', DAKAR)
const dakarTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { ...DAKAR, hour: '2-digit', minute: '2-digit' })

// Ce qui a été enregistré un jour donné : nouvelles réservations et dépenses, avec heure et date
function DayHistory({ bookings, expenses }) {
  const [day, setDay] = useState(today())

  const events = [
    ...bookings.filter((b) => dakarDay(b.created_at) === day).map((b) => ({ id: `b${b.id}`, at: b.created_at, b })),
    ...expenses.filter((e) => dakarDay(e.created_at) === day).map((e) => ({ id: `e${e.id}`, at: e.created_at, e })),
  ].sort((x, y) => new Date(y.at) - new Date(x.at))

  const fresh = events.filter((x) => x.b && x.b.status !== 'annulee')
  const booked = fresh.reduce((sum, x) => sum + Number(x.b.total_amount), 0)
  const spent = events.filter((x) => x.e).reduce((sum, x) => sum + Number(x.e.amount), 0)

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Jour</span>
          <input className="input" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} />
        </label>
        <div className="text-right text-sm">
          <p>Réservations : <b>{fresh.length}</b> · <b>{fcfa(booked)}</b></p>
          <p>Dépenses du jour : <b className="text-red-700">{fcfa(spent)}</b></p>
        </div>
      </div>

      {events.length === 0 && <p className="text-sm text-slate-500">Aucune activité enregistrée ce jour-là.</p>}

      <ul className="divide-y">
        {events.map((x) => (
          <li key={x.id} className="flex items-start gap-3 py-2 text-sm">
            <div className="w-16 shrink-0 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">{dakarTime(x.at)}</p>
              <p>{dakarDate(x.at)}</p>
            </div>
            {x.b ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold"><CalendarPlus size={14} className="shrink-0 text-salam-600" />
                    <span className="truncate">Réservation — {x.b.units?.name} · {x.b.clients?.first_name} {x.b.clients?.last_name}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Du {fdate(x.b.check_in)} au {fdate(x.b.check_out)} · {x.b.nights} nuit{x.b.nights > 1 ? 's' : ''} · avance {fcfa(x.b.advance)}
                    {x.b.status === 'annulee' && <span className="text-red-700"> · annulée</span>}
                  </p>
                </div>
                <b className="shrink-0">{fcfa(x.b.total_amount)}</b>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold"><TrendingDown size={14} className="shrink-0 text-red-700" />
                    <span className="truncate">Dépense — {x.e.category}{x.e.units?.name && ` — ${x.e.units.name}`}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {x.e.description}
                    {x.e.spent_on !== day && `${x.e.description ? ' · ' : ''}dépense du ${fdate(x.e.spent_on)}`}
                  </p>
                </div>
                <b className="shrink-0 text-red-700">− {fcfa(x.e.amount)}</b>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Réservations passées : terminées (ou annulées), avec filtre par mois d'arrivée
function PastBookings({ bookings }) {
  const t = today()
  const [month, setMonth] = useState('')
  const [kind, setKind] = useState('terminee')
  const [limit, setLimit] = useState(15)

  const rows = bookings.filter((b) => {
    const st = stageOf(b, t)
    const past = kind === 'all' ? st === 'terminee' || st === 'annulee' : st === kind
    return past && (!month || b.check_in.startsWith(month))
  })
  const counted = rows.filter((b) => b.status !== 'annulee')
  const total = counted.reduce((sum, b) => sum + Number(b.total_amount), 0)
  const unpaid = counted.reduce((sum, b) => sum + Number(b.total_amount) - Number(b.advance), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Afficher</span>
          <select className="input" value={kind} onChange={(e) => { setKind(e.target.value); setLimit(15) }}>
            <option value="terminee">Terminées</option>
            <option value="annulee">Annulées</option>
            <option value="all">Terminées et annulées</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Mois d'arrivée</span>
          <input className="input" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setLimit(15) }} />
        </label>
        <div className="ml-auto text-right text-sm">
          <p>{rows.length} réservation{rows.length > 1 ? 's' : ''} · Total <b>{fcfa(total)}</b></p>
          {unpaid > 0 && <p className="text-red-700">Restes impayés : <b>{fcfa(unpaid)}</b></p>}
        </div>
      </div>

      {rows.length === 0 && <p className="card text-sm text-slate-500">Aucune réservation pour ce filtre.</p>}

      <ul className="space-y-2">
        {rows.slice(0, limit).map((b) => {
          const st = stageOf(b, t)
          const rest = Number(b.total_amount) - Number(b.advance)
          return (
            <li key={b.id} className="card flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.units?.name} — {b.clients?.first_name} {b.clients?.last_name}</p>
                <p className="text-xs text-slate-500">{fdate(b.check_in)} → {fdate(b.check_out)} · {b.nights} nuit{b.nights > 1 ? 's' : ''}</p>
              </div>
              <div className="shrink-0 space-y-0.5 text-right">
                <p className="font-bold">{fcfa(b.total_amount)}</p>
                {st !== 'annulee' && rest > 0 && <p className="text-xs text-red-700">reste {fcfa(rest)}</p>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE[st][1]}`}>{STAGE[st][0]}</span>
              </div>
            </li>
          )
        })}
      </ul>

      {rows.length > limit && (
        <button type="button" className="btn btn-ghost w-full" onClick={() => setLimit(limit + 15)}>
          Afficher plus ({rows.length - limit} restantes)
        </button>
      )}
    </div>
  )
}

export default function Dashboard({ data, reload }) {
  const { units, bookings, expenses } = data
  const t = today()
  const month = t.slice(0, 7)
  const live = bookings.filter((b) => b.status !== 'annulee')

  // Recettes = montant total des réservations non annulées dont l'arrivée tombe dans le mois
  const revenue = live.filter((b) => b.check_in.startsWith(month)).reduce((s, b) => s + Number(b.total_amount), 0)
  const spent = expenses.filter((e) => e.spent_on.startsWith(month)).reduce((s, e) => s + Number(e.amount), 0)
  const due = live.reduce((s, b) => s + (Number(b.total_amount) - Number(b.advance)), 0)

  const current = (u) => bookings.find((b) => b.unit_id === u.id && isActive(b, t))
  const statusOf = (u) => (u.status === 'maintenance' ? 'maintenance' : current(u) ? 'occupe' : 'disponible')
  const occupied = units.filter((u) => statusOf(u) === 'occupe').length
  const rate = units.length ? Math.round((occupied / units.length) * 100) : 0

  const toggleMaintenance = async (u) => {
    await supabase.from('units').update({ status: u.status === 'maintenance' ? 'disponible' : 'maintenance' }).eq('id', u.id)
    reload()
  }

  const net = revenue - spent
  const kpis = [
    ['Recettes du mois', fcfa(revenue), Wallet, 'text-salam-700'],
    ['Dépenses du mois', fcfa(spent), TrendingDown, 'text-red-700'],
    ['Bénéfice net', fcfa(net), PiggyBank, net >= 0 ? 'text-salam-700' : 'text-red-700'],
    ["Taux d'occupation", `${rate} %`, BedDouble, 'text-gold'],
    ['Soldes à encaisser', fcfa(due), Banknote, due > 0 ? 'text-red-700' : 'text-salam-700'],
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map(([label, value, Icon, color], i) => (
          <div key={label} className={`card ${i === 4 ? 'col-span-2 md:col-span-1' : ''}`}>
            <Icon size={18} className={color} />
            <p className="mt-2 text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TodayList title="Arrivées aujourd'hui" Icon={LogIn} rows={live.filter((b) => b.check_in === t)} />
        <TodayList title="Départs aujourd'hui" Icon={LogOut} rows={live.filter((b) => b.check_out === t)} />
      </div>

      <h2 className="pt-2 font-bold">Logements ({occupied}/{units.length} occupés)</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {units.map((u) => {
          const s = statusOf(u)
          const b = current(u)
          return (
            <div key={u.id} className="card flex flex-col gap-1 p-3">
              <div className="flex items-start justify-between">
                <p className="font-semibold">{u.name}</p>
                <button
                  onClick={() => toggleMaintenance(u)}
                  disabled={s === 'occupe'}
                  aria-label="Basculer maintenance"
                  className="text-slate-400 hover:text-amber-600 disabled:opacity-30"
                ><Wrench size={16} /></button>
              </div>
              <p className="text-xs text-slate-500">{u.type}</p>
              <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[s]}`}>{LABEL[s]}</span>
              {b && <p className="truncate text-xs text-slate-600">{b.clients?.last_name}</p>}
            </div>
          )
        })}
      </div>

      <h2 className="pt-2 font-bold">Planning des 14 prochains jours</h2>
      <Planning units={units} bookings={bookings} />

      <h2 className="pt-2 font-bold">Historique de la journée</h2>
      <DayHistory bookings={bookings} expenses={expenses} />

      <h2 className="pt-2 font-bold">Réservations passées</h2>
      <PastBookings bookings={bookings} />
    </>
  )
}
