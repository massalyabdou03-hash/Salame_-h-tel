import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, LogIn, LogOut, Pencil, UserPlus, Unlock, ExternalLink, Wrench, Handshake } from 'lucide-react'
import { fcfa, fdate, today, addDays, stageOf, isHold, clientName, shortName, STAGE } from './utils'
import { monthOf, shiftMonth, monthTitle, weekdayIndex, longDate } from './calendar'
import { Badge } from './ui'
import { dakarDate, dakarTime } from './stay'

const INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const LABEL_W = '7.5rem'
const CELL_W = '1.8rem'

const daysOfMonth = (month) => {
  const first = `${month}-01`
  const next = `${shiftMonth(month, 1)}-01`
  const n = Math.round((new Date(`${next}T00:00:00Z`) - new Date(`${first}T00:00:00Z`)) / 864e5)
  return Array.from({ length: n }, (_, i) => addDays(first, i))
}

// Une réservation occupe la nuit du jour d si arrivée <= d < départ
const covers = (b, d) => b.check_in <= d && d < b.check_out

// Apparence d'une réservation sur le planning
//  - client direct : vert · via un courtier : doré · bloqué (client inconnu) : doré en pointillés
const barStyle = (b) => {
  if (isHold(b)) return 'border-2 border-dashed border-gold bg-amber-50 text-amber-900'
  if (b.broker_id) return 'bg-gold text-white'
  return 'bg-salam-600 text-white'
}

export default function Planning({ units, bookings, onFree, onOpen }) {
  const t = today()
  const [month, setMonth] = useState(monthOf(t))
  const days = useMemo(() => daysOfMonth(month), [month])
  const live = useMemo(() => bookings.filter((b) => b.status !== 'annulee'), [bookings])
  const cols = `${LABEL_W} repeat(${days.length}, minmax(${CELL_W}, 1fr))`
  const minWidth = `calc(${LABEL_W} + ${days.length} * ${CELL_W})`

  // Sur petit écran : on amène la colonne d'aujourd'hui dans la zone visible
  const scroller = useRef(null)
  useEffect(() => {
    const box = scroller.current
    const el = box?.querySelector(`[data-day="${t}"]`)
    if (!box) return
    if (!el) { box.scrollLeft = 0; return }
    const labelPx = parseFloat(LABEL_W) * 16
    box.scrollLeft = Math.max(0, el.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft - labelPx - 8)
  }, [month, t])

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h3 className="text-xl font-extrabold text-slate-900" aria-live="polite">{monthTitle(month)}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /> Mois précédent</button>
          <button type="button" className="btn btn-secondary" onClick={() => setMonth(monthOf(t))}>Aujourd'hui</button>
          <button type="button" className="btn btn-secondary" onClick={() => setMonth(shiftMonth(month, 1))}>Mois suivant <ChevronRight size={16} /></button>
        </div>
      </div>

      <div ref={scroller} className="overflow-x-auto" role="grid" aria-label={`Planning des logements, ${monthTitle(month)}`}>
        <div style={{ minWidth }}>
          {/* Jours */}
          <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: cols }}>
            <div className="sticky left-0 z-10 bg-slate-50 p-2 text-xs font-semibold text-slate-600" style={{ gridColumn: 1, gridRow: 1 }}>Logement</div>
            {days.map((d, i) => {
              const wd = weekdayIndex(d)
              return (
                <div key={d} data-day={d} style={{ gridColumn: i + 2, gridRow: 1 }} className={`border-l border-slate-200 py-1 text-center ${wd === 6 ? 'text-red-600' : 'text-slate-500'}`}>
                  <span className="block text-[10px] font-medium uppercase">{INITIALS[wd]}</span>
                  <span className={`mx-auto grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${d === t ? 'bg-salam-700 text-white' : ''}`}>{Number(d.slice(8))}</span>
                </div>
              )
            })}
          </div>

          {/* Une ligne par logement */}
          {units.map((u) => {
            const maint = u.status === 'maintenance'
            const mine = live.filter((b) => b.unit_id === u.id)
            const items = []
            for (let i = 0; i < days.length; ) {
              const d = days[i]
              const b = mine.find((x) => covers(x, d))
              if (b) {
                let span = 1
                while (i + span < days.length && covers(b, days[i + span])) span++
                const first = i === 0 && b.check_in < d ? 'continue' : ''
                items.push(
                  <div key={`b${b.id}-${i}`} style={{ gridColumn: `${i + 2} / span ${span}`, gridRow: 1 }} className="min-w-0 p-0.5">
                    <button
                      type="button"
                      onClick={() => onOpen(b)}
                      aria-label={`${u.name} : ${shortName(b)}, du ${fdate(b.check_in)} au ${fdate(b.check_out)}`}
                      title={`${shortName(b)} — ${fdate(b.check_in)} → ${fdate(b.check_out)}`}
                      className={`flex h-9 w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-left text-[11px] font-semibold leading-tight shadow-sm transition hover:brightness-110 ${barStyle(b)} ${b.checked_out_at ? 'opacity-60' : ''} ${first ? 'rounded-l-none' : ''}`}
                    >
                      {b.checked_in_at && !b.checked_out_at && <Check size={12} className="shrink-0" aria-hidden />}
                      <span className="truncate">{shortName(b)}</span>
                    </button>
                  </div>
                )
                i += span
              } else if (maint) {
                items.push(<div key={d} style={{ gridColumn: i + 2, gridRow: 1 }} className="border-l border-slate-100 bg-amber-100/70" />)
                i++
              } else if (d < t) {
                items.push(<div key={d} style={{ gridColumn: i + 2, gridRow: 1 }} className="border-l border-slate-100 bg-slate-50" />)
                i++
              } else {
                items.push(
                  <button
                    key={d}
                    type="button"
                    onClick={() => onFree(u, d)}
                    aria-label={`${u.name}, libre le ${longDate(d)}. Réserver`}
                    title={`Libre — réserver le ${longDate(d)}`}
                    style={{ gridColumn: i + 2, gridRow: 1 }}
                    className={`h-10 border-l border-slate-100 transition-colors hover:bg-salam-100 ${d === t ? 'bg-salam-50' : 'bg-white'}`}
                  />
                )
                i++
              }
            }
            return (
              <div key={u.id} role="row" className="grid border-b border-slate-100" style={{ gridTemplateColumns: cols }}>
                <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-slate-100 bg-white px-2 py-1" style={{ gridColumn: 1, gridRow: 1 }}>
                  <span className="truncate text-sm font-semibold text-slate-800">{u.name}</span>
                  <span className="truncate text-[11px] text-slate-500">{maint ? <span className="inline-flex items-center gap-1 text-amber-700"><Wrench size={10} /> En maintenance</span> : u.type}</span>
                </div>
                {items}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded border border-slate-300 bg-white" /> Libre</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded bg-salam-600" /> Client direct</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded bg-gold" /> Client amené par un courtier</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded border-2 border-dashed border-gold bg-amber-50" /> Bloqué par un courtier (client à préciser)</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 rounded bg-amber-100" /> En maintenance</span>
        </div>
        <p className="text-slate-500">Chaque case est une nuit. Appuyez sur une case vide pour réserver, sur une case colorée pour voir la réservation.</p>
      </div>
    </div>
  )
}

// ---------- Fiche d'une réservation (ouverte depuis le planning) ----------
export function BookingSheet({ b, onClose, onEdit, onDetails, onRelease, onArrive, onLeave }) {
  const hold = isHold(b)
  const stage = stageOf(b)
  const total = Number(b.total_amount)
  const rest = total - Number(b.advance)
  const canArrive = stage === 'encours' && !b.legacy && !hold && !b.checked_in_at
  const canLeave = stage !== 'annulee' && !b.legacy && !hold && b.checked_in_at && !b.checked_out_at

  return (
    <div className="card space-y-4 !p-6">
      <div className="pr-10">
        <p className="text-sm font-semibold text-salam-700">{b.units?.name}</p>
        <h2 className="text-xl font-extrabold text-slate-900">{clientName(b)}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {hold
            ? <Badge className="bg-amber-100 text-amber-900"><Handshake size={12} className="mr-1" /> Logement bloqué · client à préciser</Badge>
            : b.broker_id
              ? <Badge className="bg-amber-100 text-amber-900"><Handshake size={12} className="mr-1" /> Via {b.broker_name || 'un courtier'}</Badge>
              : <Badge className="bg-emerald-100 text-emerald-800">Client direct</Badge>}
          <Badge className={STAGE[stage][1]}>{STAGE[stage][0]}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-xs text-slate-500">Séjour</p>
          <p className="font-semibold">{fdate(b.check_in)} → {fdate(b.check_out)}</p>
          <p className="text-xs text-slate-500">{b.nights} nuit{b.nights > 1 ? 's' : ''}</p>
        </div>
        {hold ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Le logement est gardé pour {b.broker_name || 'le courtier'}. Quand le client est connu, appuyez sur <b>Ajouter le client</b>.
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-xs text-slate-500">Montant total</p>
            <p className="font-semibold">{fcfa(total)}</p>
            <p className={`text-xs font-medium ${rest > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{rest > 0 ? `Reste à payer : ${fcfa(rest)}` : '✓ Tout est payé'}</p>
          </div>
        )}
      </div>

      {(b.checked_in_at || b.checked_out_at) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-salam-50 px-4 py-2.5 text-sm">
          {b.checked_in_at && <p className="flex items-center gap-2"><LogIn size={16} className="text-salam-700" /> Arrivé le <b>{dakarDate(b.checked_in_at)}</b> à <b>{dakarTime(b.checked_in_at)}</b></p>}
          {b.checked_out_at && <p className="flex items-center gap-2"><LogOut size={16} className="text-amber-600" /> Parti le <b>{dakarDate(b.checked_out_at)}</b> à <b>{dakarTime(b.checked_out_at)}</b></p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {canArrive && <button className="btn btn-success" onClick={() => onArrive(b)}><LogIn size={16} /> Client arrivé</button>}
        {canLeave && <button className="btn btn-secondary" onClick={() => onLeave(b)}><LogOut size={16} /> Client parti</button>}
        {hold ? (
          <>
            <button className="btn btn-primary" onClick={() => onEdit(b)}><UserPlus size={16} /> Ajouter le client</button>
            <button className="btn btn-danger ml-auto" onClick={() => onRelease(b)}><Unlock size={16} /> Libérer le logement</button>
          </>
        ) : (
          <>
            {stage !== 'annulee' && <button className="btn btn-secondary" onClick={() => onEdit(b)}><Pencil size={16} /> Modifier</button>}
            <button className="btn btn-secondary" onClick={() => onDetails(b)}><ExternalLink size={16} /> Facture, contrat, annuler…</button>
          </>
        )}
      </div>
    </div>
  )
}
