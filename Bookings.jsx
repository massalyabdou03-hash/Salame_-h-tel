import { useState } from 'react'
import {
  FileText,
  FileSignature,
  Plus,
  Ban,
  Pencil,
  Banknote,
  CalendarDays
} from 'lucide-react'

import { supabase } from './supabase'
import { getOrCreateInvoice } from './invoice'
import BookingForm from './BookingForm'
import { fcfa, fdate, stageOf, STAGE } from './utils'

const FILTERS = [
  ['all', 'Toutes'],
  ['avenir', 'À venir'],
  ['encours', 'En cours'],
  ['terminee', 'Terminées'],
  ['annulee', 'Annulées']
]

export default function Bookings({ data, reload, openDoc }) {
  const [form, setForm] = useState(null)
  const [filter, setFilter] = useState('all')

  const openInvoice = async (b) => {
    const inv = await getOrCreateInvoice(b)

    if (!inv) {
      alert('Impossible de créer la facture.')
      return
    }

    openDoc({
      type: 'invoice',
      booking: b,
      invoice: inv
    })
  }

  const cancel = async (b) => {
    if (!confirm('Annuler cette réservation ?')) return

    await supabase
      .from('bookings')
      .update({ status: 'annulee' })
      .eq('id', b.id)

    reload()
  }

  const settle = async (b) => {
    const remaining =
      Number(b.total_amount) - Number(b.advance)

    if (
      !confirm(
        `Marquer le solde de ${fcfa(
          remaining
        )} comme encaissé ?`
      )
    )
      return

    const { error } = await supabase
      .from('bookings')
      .update({
        advance: b.total_amount
      })
      .eq('id', b.id)

    if (error) {
      alert(error.message)
      return
    }

    reload()
  }

  const rows = data.bookings.filter(
    (b) =>
      filter === 'all' ||
      stageOf(b) === filter
  )

  return (
    <div className="space-y-5">

      {form ? (
        <BookingForm
          key={
            form === 'new'
              ? 'new'
              : form.id
          }
          booking={
            form === 'new'
              ? undefined
              : form
          }
          units={data.units}
          clients={data.clients}
          onCancel={() => setForm(null)}
          onDone={() => {
            setForm(null)
            reload()
          }}
        />
      ) : (
        <div>
          <button
            className="btn btn-primary shadow-md"
            onClick={() => setForm('new')}
          >
            <Plus size={18} />
            Nouvelle réservation
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`badge-filter ${
              filter === id
                ? 'badge-filter-active'
                : 'badge-filter-idle'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-4">
        {rows.length === 0 && (
          <li className="card text-sm text-slate-500">
            Aucune réservation dans cette catégorie.
          </li>
        )}

        {rows.map((b) => {
          const stage = stageOf(b)

          const total =
            Number(b.total_amount)

          const advance =
            Number(b.advance)

          const rest =
            total - advance

          return (
            <li
              key={b.id}
              className={`card ${
                stage === 'annulee'
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <div className="flex flex-col gap-4">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {b.clients.first_name}{' '}
                      {b.clients.last_name}
                    </h3>

                    <p className="text-sm font-medium text-salam-700">
                      {b.units.name}
                    </p>
                  </div>

                  <span
                    className={`w-fit whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STAGE[stage][1]}`}
                  >
                    {STAGE[stage][0]}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays size={16} />
                  <span>
                    {fdate(b.check_in)} →{' '}
                    {fdate(b.check_out)}
                  </span>

                  <span className="text-slate-400">
                    •
                  </span>

                  <span>
                    {b.nights} nuit
                    {b.nights > 1 ? 's' : ''}
                  </span>
                </div>

                {rest > 0 ? (
                  <div className="stat-card-warning">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                      Reste à payer
                    </p>

                    <p className="mt-1 text-2xl font-extrabold text-amber-900">
                      {fcfa(rest)}
                    </p>
                  </div>
                ) : (
                  <div className="stat-card-success">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                      Paiement soldé
                    </p>

                    <p className="mt-1 text-2xl font-extrabold text-emerald-800">
                      ✓ Aucun reste
                    </p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Total
                    </p>

                    <p className="font-semibold">
                      {fcfa(total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Avance encaissée
                    </p>

                    <p className="font-semibold">
                      {fcfa(advance)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Mode de paiement
                    </p>

                    <p className="font-semibold">
                      {b.payment_mode}
                    </p>
                  </div>
                </div>

                {stage !== 'annulee' && (
                  <div className="section-divider">
                    <div className="flex flex-wrap items-center gap-2">

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setForm(b)

                          window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                          })
                        }}
                      >
                        <Pencil size={16} />
                        Modifier
                      </button>

                      {rest > 0 && (
                        <button
                          className="btn btn-success"
                          onClick={() =>
                            settle(b)
                          }
                        >
                          <Banknote size={16} />
                          Encaisser le solde
                        </button>
                      )}

                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          openInvoice(b)
                        }
                      >
                        <FileText size={16} />
                        Facture
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          openDoc({
                            type: 'contract',
                            booking: b
                          })
                        }
                      >
                        <FileSignature size={16} />
                        Contrat
                      </button>

                      <div className="ml-auto">
                        <button
                          className="btn btn-danger"
                          onClick={() =>
                            cancel(b)
                          }
                          aria-label="Annuler la réservation"
                        >
                          <Ban size={16} />
                          Annuler
                        </button>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
