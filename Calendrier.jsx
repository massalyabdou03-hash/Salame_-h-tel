import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, LogIn, LogOut, BedDouble, Plus } from 'lucide-react'
import { fcfa, today, clientName, isHold } from './utils'
import { WEEKDAYS, monthGrid, monthOf, shiftMonth, monthTitle, dayEvents, longDate, shortDate } from './calendar'
import { dakarTime } from './stay'

const who = clientName
const short = (b) => (b.clients ? b.clients.last_name : `${b.broker_name || 'Courtier'} (client ?)`)

// ---------- Calendrier du mois ----------
export function MonthCalendar({ bookings, selected, onSelect }) {
  const t = today()
  const [month, setMonth] = useState(monthOf(selected || t))
  const cells = useMemo(() => monthGrid(month), [month])

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h3 className="text-xl font-extrabold text-slate-900" aria-live="polite">{monthTitle(month)}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={16} /> Mois précédent
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => { setMonth(monthOf(t)); onSelect?.(t) }}>
            Aujourd'hui
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMonth(shiftMonth(month, 1))}>
            Mois suivant <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" role="grid" aria-label={monthTitle(month)}>
        {cells.map((c, i) => {
          const ev = dayEvents(bookings, c.date)
          const isToday = c.date === t
          const isSel = c.date === selected
          const extra = Math.max(0, ev.arrivals.length - 2) + Math.max(0, ev.departures.length - 2)
          return (
            <button
              key={c.date}
              type="button"
              role="gridcell"
              aria-label={`${longDate(c.date)} : ${ev.arrivals.length} arrivée(s), ${ev.departures.length} départ(s)`}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => { if (!c.inMonth) setMonth(monthOf(c.date)); onSelect?.(c.date) }}
              className={`flex min-h-[64px] flex-col items-stretch gap-1 border-b border-r border-slate-100 p-1 text-left transition-colors sm:min-h-[104px] sm:p-1.5 ${
                i % 7 === 6 ? 'border-r-0' : ''
              } ${c.inMonth ? 'bg-white hover:bg-salam-50' : 'bg-slate-50/70 hover:bg-slate-100'} ${isSel ? 'ring-2 ring-inset ring-salam-600' : ''}`}
            >
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-salam-700 text-white' : c.inMonth ? 'text-slate-800' : 'text-slate-400'
                }`}
              >
                {c.day}
              </span>

              {/* Grand écran : une ligne par arrivée / départ */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {ev.arrivals.slice(0, 2).map((b) => (
                  <span key={`a${b.id}`} className="flex items-center gap-1 truncate rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
                    <LogIn size={10} className="shrink-0" />
                    <span className="truncate">{b.units?.name} · {short(b)}</span>
                  </span>
                ))}
                {ev.departures.slice(0, 2).map((b) => (
                  <span key={`d${b.id}`} className="flex items-center gap-1 truncate rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                    <LogOut size={10} className="shrink-0" />
                    <span className="truncate">{b.units?.name} · {short(b)}</span>
                  </span>
                ))}
                {extra > 0 && <span className="px-1 text-[11px] font-medium text-slate-500">+ {extra} autre{extra > 1 ? 's' : ''}</span>}
              </span>

              {/* Téléphone : seulement des pastilles avec le nombre */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {ev.arrivals.length > 0 && <span className="rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-900">+{ev.arrivals.length}</span>}
                {ev.departures.length > 0 && <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-900">−{ev.departures.length}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200" /> Arrivée</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200" /> Départ</span>
        <span className="flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full bg-salam-700 text-[9px] font-bold text-white">1</span> Aujourd'hui</span>
        <span className="text-slate-500">Cliquez sur un jour pour voir le détail.</span>
      </div>
    </div>
  )
}

// ---------- Détail du jour choisi ----------
function DayList({ title, Icon, rows, tone, actions }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
        <Icon size={16} className={tone} /> {title} ({rows.length})
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((b) => {
            const rest = Number(b.total_amount) - Number(b.advance)
            return (
              <li key={b.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold">{b.units?.name} — {who(b)}</p>
                <p className="text-xs text-slate-500">
                  {shortDate(b.check_in)} → {shortDate(b.check_out)}
                  {isHold(b)
                    ? <span className="font-medium text-amber-700"> · client à préciser</span>
                    : rest > 0 ? <span className="font-medium text-red-700"> · reste à payer {fcfa(rest)}</span> : <span className="text-emerald-700"> · soldé</span>}
                </p>
                {(b.checked_in_at || b.checked_out_at) && (
                  <p className="mt-0.5 text-xs font-medium text-salam-700">
                    {b.checked_in_at && <>Arrivé à {dakarTime(b.checked_in_at)}</>}
                    {b.checked_in_at && b.checked_out_at && ' · '}
                    {b.checked_out_at && <>Parti à {dakarTime(b.checked_out_at)}</>}
                  </p>
                )}
                {actions && <div className="mt-1.5 flex flex-wrap gap-2">{actions(b)}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function DayPanel({ bookings, day, onNew, onArrive, onLeave }) {
  const ev = dayEvents(bookings, day)
  const isPast = day < today()
  const isToday = day === today()
  // Les heures d'arrivée et de départ ne s'enregistrent que le jour même
  const arriveBtn = (b) => isToday && onArrive && !b.legacy && !isHold(b) && b.check_in === day && !b.checked_in_at && (
    <button type="button" className="btn btn-success" onClick={() => onArrive(b)}><LogIn size={14} /> Client arrivé</button>
  )
  const leaveBtn = (b) => isToday && onLeave && !b.legacy && !isHold(b) && b.checked_in_at && !b.checked_out_at && (
    <button type="button" className="btn btn-secondary" onClick={() => onLeave(b)}><LogOut size={14} /> Client parti</button>
  )
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{longDate(day)}</h3>
          <p className="text-sm text-slate-500">
            {ev.occupied} logement{ev.occupied > 1 ? 's' : ''} occupé{ev.occupied > 1 ? 's' : ''} cette nuit-là
          </p>
        </div>
        {onNew && !isPast && (
          <button type="button" className="btn btn-primary" onClick={() => onNew(day)}>
            <Plus size={16} /> Nouvelle réservation à cette date
          </button>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <DayList title="Arrivées" Icon={LogIn} rows={ev.arrivals} tone="text-emerald-600" actions={(b) => <>{arriveBtn(b)}{leaveBtn(b)}</>} />
        <DayList title="Départs" Icon={LogOut} rows={ev.departures} tone="text-amber-600" actions={(b) => <>{arriveBtn(b)}{leaveBtn(b)}</>} />
        <DayList title="Déjà sur place" Icon={BedDouble} rows={ev.staying} tone="text-salam-600" actions={(b) => <>{arriveBtn(b)}{leaveBtn(b)}</>} />
      </div>
    </div>
  )
}
