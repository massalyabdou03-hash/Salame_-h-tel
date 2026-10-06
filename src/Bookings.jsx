import { useState } from 'react'
import { FileText, FileSignature, Plus, Ban } from 'lucide-react'
import { supabase } from './supabase'
import { getOrCreateInvoice } from './invoice'
import BookingForm from './BookingForm'
import { fcfa, fdate } from './utils'

export default function Bookings({ data, reload, openDoc }) {
  const [adding, setAdding] = useState(false)

  const openInvoice = async (b) => {
    const inv = await getOrCreateInvoice(b)
    if (inv) openDoc({ type: 'invoice', booking: b, invoice: inv })
  }

  const cancel = async (b) => {
    if (!confirm('Annuler cette réservation ?')) return
    await supabase.from('bookings').update({ status: 'annulee' }).eq('id', b.id)
    reload()
  }

  return (
    <>
      {adding ? (
        <BookingForm
          units={data.units}
          clients={data.clients}
          onCancel={() => setAdding(false)}
          onDone={() => { setAdding(false); reload() }}
        />
      ) : (
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Nouvelle réservation</button>
      )}

      <ul className="space-y-2">
        {data.bookings.length === 0 && <li className="card text-sm text-slate-500">Aucune réservation. Créez la première avec le bouton ci-dessus.</li>}
        {data.bookings.map((b) => (
          <li key={b.id} className={`card flex flex-wrap items-center justify-between gap-3 ${b.status === 'annulee' ? 'opacity-50' : ''}`}>
            <div>
              <p className="font-semibold">{b.clients.first_name} {b.clients.last_name} — {b.units.name}{b.status === 'annulee' && ' (annulée)'}</p>
              <p className="text-xs text-slate-500">{fdate(b.check_in)} au {fdate(b.check_out)} ({b.nights} nuit{b.nights > 1 ? 's' : ''}) · {b.payment_mode}</p>
              <p className="text-sm">Total {fcfa(b.total_amount)} · Avance {fcfa(b.advance)} · <b>Reste {fcfa(b.total_amount - b.advance)}</b></p>
            </div>
            {b.status !== 'annulee' && (
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => openInvoice(b)}><FileText size={16} /> Facture</button>
                <button className="btn btn-ghost" onClick={() => openDoc({ type: 'contract', booking: b })}><FileSignature size={16} /> Contrat</button>
                <button className="btn btn-ghost text-red-700" onClick={() => cancel(b)} aria-label="Annuler"><Ban size={16} /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
