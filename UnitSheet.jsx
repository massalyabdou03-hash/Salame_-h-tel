import { Plus, Wrench, ChevronRight, Users, Banknote } from 'lucide-react'
import { fcfa, fdate, today, stageOf, STAGE, isActive, isContract, clientName, sourceOf, SOURCE } from './utils'
import { Badge } from './ui'

const BADGE = { occupe: 'bg-red-100 text-red-800', disponible: 'bg-emerald-100 text-emerald-800', maintenance: 'bg-amber-100 text-amber-800' }
const LABEL = { occupe: 'Occupé', disponible: 'Libre', maintenance: 'En maintenance' }

// Une ligne de réservation : on la touche pour ouvrir sa fiche
function Row({ b, onOpen }) {
  const stage = stageOf(b)
  const rest = Number(b.total_amount) - Number(b.advance)
  return (
    <li>
      <button type="button" onClick={() => onOpen(b)} className={`flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-left transition hover:bg-salam-50 ${SOURCE[sourceOf(b)].bar}`}>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{clientName(b)}</span>
          <span className="block text-xs text-slate-500">{fdate(b.check_in)} → {fdate(b.check_out)} · {b.nights} nuit{b.nights > 1 ? 's' : ''}</span>
          {Number(b.total_amount) > 0 && !isContract(b) && (
            <span className={`block text-xs font-medium ${rest > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {fcfa(b.total_amount)} · {rest > 0 ? `reste ${fcfa(rest)}` : 'tout est payé'}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Badge className={STAGE[stage][1]}>{STAGE[stage][0]}</Badge>
          <ChevronRight size={16} className="text-slate-400" />
        </span>
      </button>
    </li>
  )
}

function Group({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

// Fiche d'un logement : informations, séjour en cours, réservations à venir et derniers séjours
export function UnitSheet({ unit, bookings, onOpenBooking, onNew, onToggleMaintenance }) {
  const t = today()
  const mine = bookings.filter((b) => b.unit_id === unit.id && b.status !== 'annulee')
  const current = mine.find((b) => isActive(b, t))
  const upcoming = mine.filter((b) => b.check_in > t).sort((a, b) => a.check_in.localeCompare(b.check_in))
  const past = mine.filter((b) => b.check_out <= t).sort((a, b) => b.check_out.localeCompare(a.check_out)).slice(0, 5)
  const s = unit.status === 'maintenance' ? 'maintenance' : current ? 'occupe' : 'disponible'
  const price = Number(unit.price_per_night || 0)

  return (
    <div className="card space-y-5 !p-6">
      <div className="pr-10">
        <p className="text-sm font-semibold text-salam-700">{unit.zone}</p>
        <h2 className="text-xl font-extrabold text-slate-900">{unit.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-700">{unit.type}</Badge>
          <Badge className={BADGE[s]}>{LABEL[s]}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Banknote size={14} /> Prix par nuit</p>
          <p className="font-semibold">{price > 0 ? fcfa(price) : 'Pas encore indiqué'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Users size={14} /> Capacité</p>
          <p className="font-semibold">{unit.max_guests} personne{unit.max_guests > 1 ? 's' : ''}</p>
        </div>
      </div>

      {current && (
        <Group title="Séjour en cours">
          <ul><Row b={current} onOpen={onOpenBooking} /></ul>
        </Group>
      )}

      <Group title={`À venir (${upcoming.length})`}>
        {upcoming.length === 0
          ? <p className="text-sm text-slate-500">Aucune réservation à venir.</p>
          : <ul className="space-y-2">{upcoming.map((b) => <Row key={b.id} b={b} onOpen={onOpenBooking} />)}</ul>}
      </Group>

      {past.length > 0 && (
        <Group title="Derniers séjours">
          <ul className="space-y-2">{past.map((b) => <Row key={b.id} b={b} onOpen={onOpenBooking} />)}</ul>
        </Group>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {s !== 'maintenance' && (
          <button type="button" className="btn btn-primary" onClick={() => onNew(unit)}><Plus size={16} /> Nouvelle réservation ici</button>
        )}
        <button type="button" className="btn btn-secondary" disabled={s === 'occupe'} onClick={() => onToggleMaintenance(unit)}>
          <Wrench size={16} /> {s === 'maintenance' ? 'Remettre en service' : 'Mettre en maintenance'}
        </button>
      </div>
      {s === 'occupe' && <p className="-mt-3 text-xs text-slate-500">Un logement occupé ne peut pas passer en maintenance.</p>}
    </div>
  )
}
