import { Wallet, TrendingDown, PiggyBank, BedDouble, Banknote, Wrench, LogIn, LogOut } from 'lucide-react'
import { supabase } from './supabase'
import { fcfa, today, addDays, isActive } from './utils'

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
    </>
  )
}
