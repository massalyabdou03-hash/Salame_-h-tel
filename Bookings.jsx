import { useEffect, useState } from 'react'
import { FileText, FileSignature, Plus, Ban, Pencil, Banknote, CalendarDays, Trash2, LogIn, LogOut, UserPlus, Unlock, Handshake } from 'lucide-react'

import { supabase } from './supabase'
import { getOrCreateInvoice } from './invoice'
import BookingForm from './BookingForm'
import { fcfa, fdate, stageOf, STAGE, isHold, clientName } from './utils'
import { PageHeader, Badge, Empty, useNotify } from './ui'
import { useStayActions, dakarDate, dakarTime } from './stay'

const FILTERS = [
  ['all', 'Toutes'],
  ['avenir', 'À venir'],
  ['encours', 'En cours'],
  ['terminee', 'Terminées'],
  ['annulee', 'Annulées'],
]

export default function Bookings({ data, reload, openDoc, startNew, onStarted, goPro, focusId, onFocused }) {
  const { toast, confirm, inform } = useNotify()
  const { arrive, leave, undo } = useStayActions(reload)
  const [form, setForm] = useState(startNew ? 'new' : null)
  const [newDate, setNewDate] = useState(startNew?.date || null)
  const [fromProforma, setFromProforma] = useState(startNew?.proformaId ? { id: startNew.proformaId, prefill: startNew.prefill } : null)
  const [filter, setFilter] = useState('all')

  // Demande venue de l'accueil : « Nouvelle réservation » (éventuellement avec une date choisie)
  useEffect(() => {
    if (!startNew) return
    setNewDate(startNew.date || null)
    setFromProforma(startNew.proformaId ? { id: startNew.proformaId, prefill: startNew.prefill } : null)
    setForm('new')
    onStarted?.()
  }, [startNew]) // eslint-disable-line react-hooks/exhaustive-deps

  // Venu du planning : on montre la réservation choisie (liste complète, défilement, surbrillance)
  const [lit, setLit] = useState(null)
  useEffect(() => {
    if (!focusId) return
    setFilter('all')
    setLit(focusId)
    onFocused?.()
    const timer = setTimeout(() => setLit(null), 4000)
    return () => clearTimeout(timer)
  }, [focusId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lit) document.getElementById(`res-${lit}`)?.scrollIntoView({ block: 'center' })
  }, [lit, filter])

  const openInvoice = async (b) => {
    const inv = await getOrCreateInvoice(b)
    if (!inv) return toast("La facture n'a pas pu être créée. Vérifiez la connexion internet et réessayez.", 'error')
    openDoc({ type: 'invoice', booking: b, invoice: inv })
  }

  const cancel = async (b) => {
    const ok = await confirm({
      title: 'Annuler cette réservation ?',
      message: `${clientName(b)} — ${b.units.name}, du ${fdate(b.check_in)} au ${fdate(b.check_out)}.\n\nLe logement redeviendra libre pour ces dates. La réservation restera visible dans « Annulées ».`,
      confirmLabel: 'Oui, annuler la réservation',
      cancelLabel: 'Non, la garder',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('bookings').update({ status: 'annulee' }).eq('id', b.id)
    if (error) return toast(`L'annulation n'a pas pu être enregistrée : ${error.message}`, 'error')
    toast('La réservation a été annulée.')
    reload()
  }

  const remove = async (b) => {
    if (b.commission_paid_at) {
      await inform({
        title: 'Suppression impossible',
        message: "La commission du courtier a déjà été versée pour cette réservation. Annulez d'abord le versement dans la page Courtiers.",
      })
      return
    }

    // La facture de la réservation est supprimée avec elle : on prévient avant de confirmer
    const { data: inv } = await supabase.from('invoices').select('number').eq('booking_id', b.id).maybeSingle()

    let msg = `${clientName(b)} — ${b.units.name}, du ${fdate(b.check_in)} au ${fdate(b.check_out)}.`
    if (inv) msg += `\n\nLa facture ${inv.number} sera supprimée aussi.`
    msg += '\n\nCette action est définitive.'
    if (isHold(b)) {
      if (!(await confirm({ title: 'Libérer ce logement ?', message: `${clientName(b)} — ${b.units.name}, du ${fdate(b.check_in)} au ${fdate(b.check_out)}.\n\nLe blocage sera retiré et le logement sera de nouveau libre.`, confirmLabel: 'Oui, libérer', cancelLabel: 'Non, le garder', danger: true }))) return
    } else if (!(await confirm({ title: 'Supprimer cette réservation ?', message: msg, confirmLabel: 'Oui, supprimer', cancelLabel: 'Non, la garder', danger: true }))) return

    if (b.status !== 'annulee' && Number(b.advance) > 0) {
      const sure = await confirm({
        title: 'Dernière vérification',
        message: `Une avance de ${fcfa(b.advance)} est enregistrée sur cette réservation. Voulez-vous vraiment la supprimer ?`,
        confirmLabel: 'Oui, supprimer quand même',
        cancelLabel: 'Non, la garder',
        danger: true,
      })
      if (!sure) return
    }

    const { error } = await supabase.from('bookings').delete().eq('id', b.id)
    if (error) {
      if (error.message.includes('COMMISSION_VERSEE')) {
        return inform({ title: 'Suppression impossible', message: "La commission du courtier a déjà été versée. Annulez d'abord le versement dans la page Courtiers." })
      }
      return toast(`La suppression n'a pas pu être faite : ${error.message}`, 'error')
    }
    toast(isHold(b) ? 'Le logement est de nouveau libre.' : 'La réservation a été supprimée.')
    reload()
  }

  const settle = async (b) => {
    const remaining = Number(b.total_amount) - Number(b.advance)
    const ok = await confirm({
      title: 'Encaisser le solde ?',
      message: `${clientName(b)} a payé les ${fcfa(remaining)} qui restaient ?\n\nLa réservation sera marquée comme entièrement payée.`,
      confirmLabel: 'Oui, solde encaissé',
    })
    if (!ok) return
    const { error } = await supabase.from('bookings').update({ advance: b.total_amount }).eq('id', b.id)
    if (error) return toast(`Le paiement n'a pas pu être enregistré : ${error.message}`, 'error')
    toast(`Solde de ${fcfa(remaining)} encaissé.`)
    reload()
  }

  const counts = Object.fromEntries(FILTERS.map(([id]) => [id, id === 'all' ? data.bookings.length : data.bookings.filter((b) => stageOf(b) === id).length]))
  const rows = data.bookings.filter((b) => filter === 'all' || stageOf(b) === filter)

  return (
    <div className="space-y-6">
      <PageHeader title="Réservations" subtitle="Toutes les réservations de l'hôtel">
        {!form && goPro && <button className="btn btn-secondary btn-lg" onClick={goPro}><FileText size={18} /> Factures proforma</button>}
        {!form && (
          <button className="btn btn-primary btn-lg" onClick={() => { setNewDate(null); setFromProforma(null); setForm('new') }}>
            <Plus size={18} /> Nouvelle réservation
          </button>
        )}
      </PageHeader>

      {form && (
        <BookingForm
          key={form === 'new' ? `new-${newDate}-${fromProforma?.id || ''}` : form.id}
          prefill={form === 'new' ? fromProforma?.prefill : undefined}
          booking={form === 'new' ? undefined : form}
          initialDate={form === 'new' ? newDate : undefined}
          units={data.units}
          clients={data.clients}
          brokers={data.brokers}
          reloadBrokers={reload}
          onCancel={() => setForm(null)}
          onDone={async (bookingId) => {
            // Réservation créée depuis un proforma : on le marque « transformé » et on garde le lien
            if (form === 'new' && fromProforma?.id && bookingId) {
              const { error } = await supabase.from('proformas').update({ status: 'acceptee', booking_id: bookingId }).eq('id', fromProforma.id)
              if (error) toast(`La réservation est enregistrée, mais le proforma n'a pas pu être mis à jour : ${error.message}`, 'error')
              else toast('La réservation a été enregistrée et le proforma est marqué « transformé ».')
            } else {
              toast(form === 'new' ? 'La réservation a été enregistrée.' : 'Les modifications ont été enregistrées.')
            }
            setFromProforma(null)
            setForm(null)
            reload()
          }}
        />
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`badge-filter ${filter === id ? 'badge-filter-active' : 'badge-filter-idle'}`}>
            {label} <span className="opacity-70">({counts[id]})</span>
          </button>
        ))}
      </div>

      <ul className="space-y-4">
        {rows.length === 0 && <li><Empty>Aucune réservation dans cette catégorie.</Empty></li>}

        {rows.map((b) => {
          const stage = stageOf(b)
          const total = Number(b.total_amount)
          const advance = Number(b.advance)
          const rest = total - advance
          const hold = isHold(b)

          return (
            <li key={b.id} id={`res-${b.id}`} className={`card space-y-4 transition ${stage === 'annulee' ? 'opacity-60' : ''} ${lit === b.id ? 'ring-4 ring-gold/60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">{clientName(b)}</h3>
                  <p className="text-sm font-semibold text-salam-700">{b.units.name}</p>
                  {(hold || b.broker_id) && (
                    <p className="mt-1 flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      <Handshake size={12} /> {hold ? 'Client à préciser' : `Via ${b.broker_name || 'un courtier'}`}
                    </p>
                  )}
                  {b.legacy && (
                    <p className="mt-1 w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Ancienne réservation{b.note ? ` · ${b.note}` : ''}
                    </p>
                  )}
                </div>
                <Badge className={`!px-3 !py-1 ${STAGE[stage][1]}`}>{STAGE[stage][0]}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Séjour</p>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <CalendarDays size={15} className="shrink-0 text-slate-400" />
                    {fdate(b.check_in)} → {fdate(b.check_out)}
                  </p>
                  <p className="text-xs text-slate-500">{b.nights} nuit{b.nights > 1 ? 's' : ''}</p>
                </div>
                {hold ? (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 lg:col-span-3">
                    Le logement est gardé pour {b.broker_name || 'le courtier'}. Aucun prix pour l'instant : appuyez sur <b>Ajouter le client</b> quand il est connu.
                  </p>
                ) : (<>
                <div>
                  <p className="text-xs text-slate-500">Montant total</p>
                  <p className="font-semibold">{fcfa(total)}</p>
                  <p className="text-xs text-slate-500">{b.payment_mode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Déjà payé</p>
                  <p className="font-semibold">{fcfa(advance)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reste à payer</p>
                  {rest > 0 ? (
                    <p className="text-lg font-extrabold text-amber-700">{fcfa(rest)}</p>
                  ) : (
                    <p className="text-lg font-extrabold text-emerald-700">✓ Tout est payé</p>
                  )}
                </div>
                </>)}
              </div>

              {(b.checked_in_at || b.checked_out_at) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl bg-salam-50 px-4 py-2.5 text-sm">
                  {b.checked_in_at && (
                    <p className="flex flex-wrap items-center gap-2">
                      <LogIn size={16} className="text-salam-700" />
                      <span>Client arrivé le <b>{dakarDate(b.checked_in_at)}</b> à <b>{dakarTime(b.checked_in_at)}</b></span>
                      {!b.checked_out_at && <button className="text-xs font-medium text-slate-500 underline" onClick={() => undo(b, 'checked_in_at')}>Effacer</button>}
                    </p>
                  )}
                  {b.checked_out_at && (
                    <p className="flex flex-wrap items-center gap-2">
                      <LogOut size={16} className="text-amber-600" />
                      <span>Client parti le <b>{dakarDate(b.checked_out_at)}</b> à <b>{dakarTime(b.checked_out_at)}</b></span>
                      <button className="text-xs font-medium text-slate-500 underline" onClick={() => undo(b, 'checked_out_at')}>Effacer</button>
                    </p>
                  )}
                </div>
              )}

              <div className="section-divider">
                <div className="flex flex-wrap items-center gap-2">
                  {stage === 'encours' && !b.legacy && !hold && !b.checked_in_at && (
                    <button className="btn btn-success" onClick={() => arrive(b)}><LogIn size={16} /> Client arrivé</button>
                  )}
                  {stage !== 'annulee' && !b.legacy && !hold && b.checked_in_at && !b.checked_out_at && (
                    <button className="btn btn-secondary" onClick={() => leave(b)}><LogOut size={16} /> Client parti</button>
                  )}
                  {stage !== 'annulee' && (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setForm(b)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        {hold ? <><UserPlus size={16} /> Ajouter le client</> : <><Pencil size={16} /> Modifier</>}
                      </button>

                      {!hold && rest > 0 && (
                        <button className="btn btn-success" onClick={() => settle(b)}>
                          <Banknote size={16} /> Encaisser le solde
                        </button>
                      )}

                      {!b.legacy && !hold && (
                        <>
                          <button className="btn btn-secondary" onClick={() => openInvoice(b)}>
                            <FileText size={16} /> Facture
                          </button>
                          <button className="btn btn-secondary" onClick={() => openDoc({ type: 'contract', booking: b })}>
                            <FileSignature size={16} /> Contrat
                          </button>
                        </>
                      )}
                    </>
                  )}

                  <div className="ml-auto flex flex-wrap gap-2">
                    {stage !== 'annulee' && !hold && (
                      <button className="btn btn-danger" onClick={() => cancel(b)} aria-label="Annuler la réservation">
                        <Ban size={16} /> Annuler
                      </button>
                    )}
                    <button className="btn btn-danger" onClick={() => remove(b)} aria-label={hold ? 'Libérer le logement' : 'Supprimer la réservation'}>
                      {hold ? <><Unlock size={16} /> Libérer le logement</> : <><Trash2 size={16} /> {stage === 'annulee' ? 'Supprimer définitivement' : 'Supprimer'}</>}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
