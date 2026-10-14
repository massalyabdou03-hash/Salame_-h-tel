import { useState } from 'react'
import { CalendarPlus, LogIn, LogOut, TrendingDown, Wallet, Handshake, PiggyBank, BedDouble, Banknote, Wrench, Plus, Pencil } from 'lucide-react'
import { supabase } from './supabase'
import { fcfa, fdate, today, isActive, stageOf, STAGE, isHold, isJotted, clientName, sourceOf, SOURCE } from './utils'
import { Field, PageHeader, Section, Stat, Badge, Empty, Modal, useNotify } from './ui'
import { MonthCalendar, DayPanel } from './Calendrier'
import Planning, { BookingSheet } from './Planning'
import BookingForm from './BookingForm'
import QuickNote from './QuickNote'
import QuickBooking from './QuickBooking'
import { UnitSheet } from './UnitSheet'
import { longDate } from './calendar'
import { useStayActions, dakarDay, dakarDate, dakarTime } from './stay'

const BADGE = { occupe: 'bg-red-100 text-red-800', disponible: 'bg-emerald-100 text-emerald-800', maintenance: 'bg-amber-100 text-amber-800' }
const LABEL = { occupe: 'Occupé', disponible: 'Libre', maintenance: 'En maintenance' }

// ---------- Historique ----------
// Ce qui a été enregistré un jour donné : nouvelles réservations et dépenses, avec heure et date
function DayHistory({ bookings, expenses }) {
  const [day, setDay] = useState(today())

  const events = [
    ...bookings.filter((b) => dakarDay(b.created_at) === day).map((b) => ({ id: `b${b.id}`, at: b.created_at, b })),
    ...expenses.filter((e) => dakarDay(e.created_at) === day).map((e) => ({ id: `e${e.id}`, at: e.created_at, e })),
    ...bookings.filter((b) => b.checked_in_at && dakarDay(b.checked_in_at) === day).map((b) => ({ id: `i${b.id}`, at: b.checked_in_at, s: b, out: false })),
    ...bookings.filter((b) => b.checked_out_at && dakarDay(b.checked_out_at) === day).map((b) => ({ id: `o${b.id}`, at: b.checked_out_at, s: b, out: true })),
  ].sort((x, y) => new Date(y.at) - new Date(x.at))

  const fresh = events.filter((x) => x.b && x.b.status !== 'annulee')
  const booked = fresh.reduce((sum, x) => sum + Number(x.b.total_amount), 0)
  const spent = events.filter((x) => x.e).reduce((sum, x) => sum + Number(x.e.amount), 0)

  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <Field label="Choisir un jour" className="min-w-0">
          <input className="input min-w-0" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} />
        </Field>
        <div className="space-y-0.5 text-sm sm:text-right">
          <p>Nouvelles réservations : <b>{fresh.length}</b></p>
          <p>Montant : <b>{fcfa(booked)}</b></p>
          <p>Dépenses du jour : <b className="text-red-700">{fcfa(spent)}</b></p>
        </div>
      </div>

      {events.length === 0 && <p className="text-sm text-slate-500">Rien n'a été enregistré ce jour-là.</p>}

      <ul className="max-h-[34rem] divide-y overflow-y-auto">
        {events.map((x) => (
          <li key={x.id} className="flex items-start gap-3 py-2 text-sm">
            <div className="w-16 shrink-0 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">{dakarTime(x.at)}</p>
              <p>{dakarDate(x.at)}</p>
            </div>
            {x.s ? (
              <div className="min-w-0 flex-1">
                <p className="flex items-start gap-1 font-semibold">
                  {x.out ? <LogOut size={14} className="mt-0.5 shrink-0 text-amber-600" /> : <LogIn size={14} className="mt-0.5 shrink-0 text-emerald-600" />}
                  <span className="min-w-0 break-words">{x.out ? 'Départ' : 'Arrivée'} — {x.s.units?.name} · {clientName(x.s)}</span>
                </p>
                <p className="text-xs text-slate-500">Séjour du {fdate(x.s.check_in)} au {fdate(x.s.check_out)}</p>
              </div>
            ) : x.b ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-1 font-semibold"><CalendarPlus size={14} className="mt-0.5 shrink-0 text-salam-600" />
                    <span className="min-w-0 break-words">Réservation — {x.b.units?.name} · {clientName(x.b)}</span>
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
                  <p className="flex items-start gap-1 font-semibold"><TrendingDown size={14} className="mt-0.5 shrink-0 text-red-700" />
                    <span className="min-w-0 break-words">Dépense — {x.e.category}{x.e.units?.name && ` — ${x.e.units.name}`}</span>
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
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label="Afficher" className="min-w-0">
          <select className="input min-w-0" value={kind} onChange={(e) => { setKind(e.target.value); setLimit(15) }}>
            <option value="terminee">Terminées</option>
            <option value="annulee">Annulées</option>
            <option value="all">Terminées et annulées</option>
          </select>
        </Field>
        <Field label="Mois d'arrivée" className="min-w-0">
          <input className="input min-w-0" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setLimit(15) }} />
        </Field>
        <div className="col-span-2 text-sm">
          <p>{rows.length} réservation{rows.length > 1 ? 's' : ''} · Total <b>{fcfa(total)}</b></p>
          {unpaid > 0 && <p className="text-red-700">Restes impayés : <b>{fcfa(unpaid)}</b></p>}
        </div>
      </div>

      {rows.length === 0 && <Empty>Aucune réservation pour ce choix.</Empty>}

      <ul className="space-y-2">
        {rows.slice(0, limit).map((b) => {
          const st = stageOf(b, t)
          const rest = Number(b.total_amount) - Number(b.advance)
          return (
            <li key={b.id} className="card flex items-center justify-between gap-3 !p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.units?.name} — {clientName(b)}</p>
                <p className="text-xs text-slate-500">{fdate(b.check_in)} → {fdate(b.check_out)} · {b.nights} nuit{b.nights > 1 ? 's' : ''}{b.note ? ` · ${b.note}` : ''}</p>
              </div>
              <div className="shrink-0 space-y-0.5 text-right">
                <p className="font-bold">{fcfa(b.total_amount)}</p>
                {st !== 'annulee' && rest > 0 && <p className="text-xs text-red-700">reste {fcfa(rest)}</p>}
                <Badge className={STAGE[st][1]}>{STAGE[st][0]}</Badge>
              </div>
            </li>
          )
        })}
      </ul>

      {rows.length > limit && (
        <button type="button" className="btn btn-secondary w-full" onClick={() => setLimit(limit + 15)}>
          Afficher plus ({rows.length - limit} restantes)
        </button>
      )}
    </div>
  )
}

export default function Dashboard({ data, reload, goNew, goBooking }) {
  const { units, bookings, expenses } = data
  const { toast, confirm } = useNotify()
  const { arrive, leave } = useStayActions(reload)
  const t = today()
  const month = t.slice(0, 7)
  const live = bookings.filter((b) => b.status !== 'annulee')
  const [day, setDay] = useState(t)
  const [view, setView] = useState('planning')
  const [form, setForm] = useState(null) // { booking } pour modifier, { date, unit_id } pour une nouvelle réservation
  const [sheetId, setSheetId] = useState(null)
  const [unitId, setUnitId] = useState(null) // fiche d'un logement, ouverte en touchant sa carte
  const unitOpen = unitId ? units.find((u) => u.id === unitId) : null
  const sheet = sheetId ? bookings.find((b) => b.id === sheetId) : null

  const [quick, setQuick] = useState(null) // écriture directe : { unit, date } ou { unit, booking } pour corriger

  const [qedit, setQedit] = useState(null) // modification d'une réservation avec le formulaire rapide
  // Formulaire rapide partout ; le formulaire complet (client déjà enregistré…) s'ouvre depuis un lien
  const startNew = (date, unit_id) => { setSheetId(null); setForm(null); setQedit(null); setQuick({ unit: units.find((u) => u.id === unit_id) || null, date: date || t }) }
  const openFull = (date, unit_id) => { setSheetId(null); setQuick(null); setQedit(null); setForm({ date: date || null, unit_id: unit_id || null }) }
  const editBooking = (b) => { setSheetId(null); if (b.legacy) setForm({ booking: b }); else setQedit(b) }

  // Libère un logement bloqué par un courtier (aucun argent en jeu)
  const release = async (b) => {
    const ok = await confirm({
      title: isJotted(b) ? 'Effacer ce qui est écrit ?' : 'Libérer ce logement ?',
      message: `${clientName(b)} — ${b.units?.name}, du ${fdate(b.check_in)} au ${fdate(b.check_out)}.\n\n${isJotted(b) ? 'Ce texte sera effacé' : 'Le blocage sera retiré'} et le logement sera de nouveau libre.`,
      confirmLabel: isJotted(b) ? 'Oui, effacer' : 'Oui, libérer',
      cancelLabel: 'Non, le garder',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('bookings').delete().eq('id', b.id)
    if (error) return toast(`Le logement n'a pas pu être libéré : ${error.message}`, 'error')
    setSheetId(null)
    toast('Le logement est de nouveau libre.')
    reload()
  }

  // Total des réservations = montant total des réservations non annulées dont l'arrivée tombe dans le mois
  const revenue = live.filter((b) => b.check_in.startsWith(month)).reduce((s, b) => s + Number(b.total_amount), 0)
  const spent = expenses.filter((e) => e.spent_on.startsWith(month)).reduce((s, e) => s + Number(e.amount), 0)
  // Commissions des courtiers : même règle de mois (mois d'arrivée), réservations annulées exclues
  const commissions = live.filter((b) => b.check_in.startsWith(month)).reduce((s, b) => s + Number(b.commission_amount || 0), 0)
  const due = live.reduce((s, b) => s + (Number(b.total_amount) - Number(b.advance)), 0)
  const net = revenue - spent - commissions

  const current = (u) => bookings.find((b) => b.unit_id === u.id && isActive(b, t))
  const statusOf = (u) => (u.status === 'maintenance' ? 'maintenance' : current(u) ? 'occupe' : 'disponible')
  const occupied = units.filter((u) => statusOf(u) === 'occupe').length

  const toggleMaintenance = async (u) => {
    const next = u.status === 'maintenance' ? 'disponible' : 'maintenance'
    const { error } = await supabase.from('units').update({ status: next }).eq('id', u.id)
    if (error) return toast(`Le changement n'a pas pu être enregistré : ${error.message}`, 'error')
    toast(next === 'maintenance' ? `${u.name} est maintenant en maintenance.` : `${u.name} est de nouveau disponible.`)
    reload()
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Accueil" subtitle={`Aujourd'hui : ${longDate(t)}`}>
        <button className="btn btn-primary btn-lg" onClick={() => startNew()}><Plus size={18} /> Nouvelle réservation</button>
      </PageHeader>

      {form && (
        <Modal label={form.booking ? 'Modifier la réservation' : 'Nouvelle réservation'} onClose={() => setForm(null)}>
          <BookingForm
            key={form.booking ? form.booking.id : `new-${form.date}-${form.unit_id}`}
            booking={form.booking}
            initialDate={form.date}
            initialUnit={form.unit_id}
            units={units}
            clients={data.clients}
            brokers={data.brokers}
            reloadBrokers={reload}
            onCancel={() => setForm(null)}
            onDone={(_id, info) => {
              toast(form.booking ? 'Les modifications ont été enregistrées.' : info?.hold ? 'Le logement est bloqué pour le courtier.' : 'La réservation a été enregistrée.')
              setForm(null)
              reload()
            }}
          />
        </Modal>
      )}

      {quick && !quick.booking && (
        <Modal label="Réservation rapide" onClose={() => setQuick(null)} width="max-w-md">
          <QuickBooking
            key={`${quick.unit?.id || 'pick'}-${quick.date}`}
            unit={quick.unit}
            units={units}
            date={quick.date}
            bookings={bookings}
            brokers={data.brokers}
            reloadBrokers={reload}
            onCancel={() => setQuick(null)}
            onMore={() => openFull(quick.date, quick.unit?.id)}
            onDone={(_id, info) => { toast(info?.hold ? 'Le logement est bloqué pour le courtier.' : 'La réservation a été enregistrée.'); setQuick(null); reload() }}
          />
        </Modal>
      )}

      {quick && quick.booking && (
        <Modal label="Écrire sur le planning" onClose={() => setQuick(null)} width="max-w-md">
          <QuickNote
            key={quick.booking ? quick.booking.id : `${quick.unit?.id || 'pick'}-${quick.date}`}
            unit={quick.unit}
            units={units}
            date={quick.date}
            booking={quick.booking}
            bookings={bookings}
            onCancel={() => setQuick(null)}
            onMore={() => openFull(quick.date, quick.unit?.id)}
            onDone={(edited) => { toast(edited ? 'Les modifications ont été enregistrées.' : 'C\'est noté sur le planning.'); setQuick(null); reload() }}
          />
        </Modal>
      )}

      {qedit && (
        <Modal label="Modifier la réservation" onClose={() => setQedit(null)} width="max-w-md">
          <QuickBooking
            key={qedit.id}
            booking={qedit}
            units={units}
            bookings={bookings}
            brokers={data.brokers}
            reloadBrokers={reload}
            onCancel={() => setQedit(null)}
            onDone={() => { toast('Les modifications ont été enregistrées.'); setQedit(null); reload() }}
          />
        </Modal>
      )}

      {unitOpen && !form && !quick && !qedit && !sheet && (
        <Modal label="Fiche du logement" onClose={() => setUnitId(null)} width="max-w-xl">
          <UnitSheet
            unit={unitOpen}
            bookings={bookings}
            onOpenBooking={(b) => { setUnitId(null); setSheetId(b.id) }}
            onNew={(u) => { setUnitId(null); setQuick({ unit: u, date: t }) }}
            onToggleMaintenance={async (u) => { await toggleMaintenance(u); setUnitId(null) }}
          />
        </Modal>
      )}

      {sheet && !form && !quick && !qedit && (
        <Modal label="Fiche de la réservation" onClose={() => setSheetId(null)} width="max-w-xl">
          <BookingSheet
            b={sheet}
            onEdit={editBooking}
            onQuick={(b) => { setSheetId(null); setQuick({ unit: b.units, booking: b }) }}
            onDetails={(b) => goBooking(b.id)}
            onRelease={release}
            onArrive={arrive}
            onLeave={leave}
          />
        </Modal>
      )}

      <Section
        title={view === 'planning' ? 'Planning des logements' : 'Calendrier des réservations'}
        hint={view === 'planning' ? 'Qui occupe quel logement, jour par jour.' : 'Les arrivées sont en vert, les départs en orange.'}
        action={
          <div className="flex flex-wrap gap-2">
            {[['planning', 'Planning des logements'], ['mois', 'Calendrier du mois']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} className={`badge-filter ${view === id ? 'badge-filter-active' : 'badge-filter-idle'}`}>{label}</button>
            ))}
          </div>
        }
      >
        {view === 'planning' && (
          <button type="button" className="btn btn-primary btn-lg w-full sm:w-auto" onClick={() => setQuick({ unit: null, date: t })}>
            <Pencil size={18} /> Écrire sur le planning
          </button>
        )}
        {view === 'planning' ? (
          <Planning units={units} bookings={bookings} onFree={(u, d) => { setSheetId(null); setQuick({ unit: u, date: d }) }} onOpen={(b) => setSheetId(b.id)} />
        ) : (
          <>
            <MonthCalendar bookings={bookings} selected={day} onSelect={setDay} />
            <DayPanel bookings={bookings} day={day} onNew={(d) => { setSheetId(null); setForm(null); setQuick({ unit: null, date: d }) }} onArrive={arrive} onLeave={leave} />
          </>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Total des réservations du mois" value={fcfa(revenue)} Icon={Wallet} tone="green" />
        <Stat label="Dépenses du mois" value={fcfa(spent)} Icon={TrendingDown} tone="red" />
        <Stat label="Commissions des courtiers" value={fcfa(commissions)} hint="Pour les réservations du mois" Icon={Handshake} tone="amber" />
        <Stat label="Gain du mois" value={fcfa(net)} hint="Réservations − dépenses − commissions" Icon={PiggyBank} tone={net >= 0 ? 'green' : 'red'} />
        <Stat label="Logements occupés aujourd'hui" value={`${occupied} sur ${units.length}`} Icon={BedDouble} tone="gold" />
        <Stat label="Reste à encaisser" value={fcfa(due)} hint="Sommes pas encore payées par les clients" Icon={Banknote} tone={due > 0 ? 'red' : 'green'} />
      </div>

      <Section title={`Logements (${occupied} occupé${occupied > 1 ? 's' : ''} sur ${units.length})`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {units.map((u) => {
            const s = statusOf(u)
            const b = current(u)
            return (
              <div
                key={u.id}
                // Toucher la carte (hors bouton clé) ouvre la fiche du logement
                onClick={(e) => { if (!e.target.closest('button')) setUnitId(u.id) }}
                className="card flex cursor-pointer flex-col gap-1.5 !p-4 transition hover:border-salam-600/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="text-left font-bold" onClick={() => setUnitId(u.id)} aria-label={`Ouvrir la fiche de ${u.name}`}>{u.name}</button>
                  <button
                    onClick={() => toggleMaintenance(u)}
                    disabled={s === 'occupe'}
                    aria-label={u.status === 'maintenance' ? `Remettre ${u.name} en service` : `Mettre ${u.name} en maintenance`}
                    title={u.status === 'maintenance' ? 'Remettre en service' : 'Mettre en maintenance'}
                    className="text-slate-400 hover:text-amber-600 disabled:opacity-30"
                  ><Wrench size={16} /></button>
                </div>
                <p className="text-xs text-slate-500">{u.type}</p>
                <Badge className={BADGE[s]}>{LABEL[s]}</Badge>
                {b && (
                  <div className="text-xs text-slate-600">
                    <p className="flex items-center gap-1.5 font-medium"><span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE[sourceOf(b)].dot}`} /><span className="truncate">{clientName(b)}</span></p>
                    <p>jusqu'au {fdate(b.check_out)}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Historique de la journée" hint="Ce qui a été enregistré ce jour-là, avec l'heure.">
          <DayHistory bookings={bookings} expenses={expenses} />
        </Section>
        <Section title="Réservations passées" hint="Les séjours terminés ou annulés.">
          <PastBookings bookings={bookings} />
        </Section>
      </div>
    </div>
  )
}
