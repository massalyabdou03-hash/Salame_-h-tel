import { useState } from 'react'
import { FileText, FileSignature, Plus, Ban, Pencil, Banknote } from 'lucide-react'
import { supabase } from './supabase'
import { getOrCreateInvoice } from './invoice'
import BookingForm from './BookingForm'
import { fcfa, fdate, stageOf, STAGE } from './utils'

const FILTERS = [['all', 'Toutes'], ['avenir', 'À venir'], ['encours', 'En cours'], ['terminee', 'Terminées'], ['annulee', 'Annulées']]

export default function Bookings({ data, reload, openDoc }) {
  const [form, setForm] = useState(null) // null | 'new' | une réservation à modifier
  const [filter, setFilter] = useState('all')

  const openInvoice = async (b) => {
    const inv = await getOrCreateInvoice(b)
    if (!inv) return alert("Impossible de créer la facture. Réessayez.")
    openDoc({ type: 'invoice', booking: b, invoice: inv })
  }

  const cancel = async (b) => {
    if (!confirm('Annuler cette réservation ?')) return
    await supabase.from('bookings').update({ status: 'annulee' }).eq('id', b.id)
    reload()
  }

  const settle = async (b) => {
    if (!confirm(`Marquer le solde de ${fcfa(b.total_amount - b.advance)} comme encaissé ?`)) return
    const { error } = await supabase.from('bookings').update({ advance: b.total_amount }).eq('id', b.id)
    if (error) return alert(error.message)
    reload()
  }

  const rows = data.bookings.filter((b) => filter === 'all' || stageOf(b) === filter)

  return (
    <>
      {form ? (
        <BookingForm
          key={form === 'new' ? 'new' : form.id}
          booking={form === 'new' ? undefined : form}
          units={data.units}
          clients={data.clients}
          onCancel={() => setForm(null)}
          onDone={() => { setForm(null); reload() }}
        />
      ) : (
        <button className="btn btn-primary" onClick={() => setForm('new')}><Plus size={16} /> Nouvelle réservation</button>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${filter === id ? 'border-salam-700 bg-salam-700 text-white' : 'border-slate-300 bg-white text-slate-600'}`}
          >{label}</button>
        ))}
      </div>

      <ul className="space-y-2">
        {rows.length === 0 && <li className="card text-sm text-slate-500">Aucune réservation dans cette catégorie.</li>}
        {rows.map((b) => {
          const stage = stageOf(b)
          const rest = Number(b.total_amount) - Number(b.advance)
          return (
            <li key={b.id} className={`card space-y-2 ${stage === 'annulee' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{b.clients.first_name} {b.clients.last_name} — {b.units.name}</p>
                  <p className="text-xs text-slate-500">{fdate(b.check_in)} au {fdate(b.check_out)} ({b.nights} nuit{b.nights > 1 ? 's' : ''}) · {b.payment_mode}</p>
                </div>
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STAGE[stage][1]}`}>{STAGE[stage][0]}</span>
              </div>
              <p className="text-sm">
                Total {fcfa(b.total_amount)} · Avance {fcfa(b.advance)} ·{' '}
                {rest > 0 ? <b className="text-red-700">Reste {fcfa(rest)}</b> : <b className="text-salam-700">Soldé</b>}
              </p>
              {stage !== 'annulee' && (
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-ghost" onClick={() => { setForm(b); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil size={16} /> Modifier</button>
                  {rest > 0 && <button className="btn btn-ghost" onClick={() => settle(b)}><Banknote size={16} /> Encaisser le solde</button>}
                  <button className="btn btn-ghost" onClick={() => openInvoice(b)}><FileText size={16} /> Facture</button>
                  <button className="btn btn-ghost" onClick={() => openDoc({ type: 'contract', booking: b })}><FileSignature size={16} /> Contrat</button>
                  <button className="btn btn-ghost text-red-700" onClick={() => cancel(b)} aria-label="Annuler la réservation"><Ban size={16} /></button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
