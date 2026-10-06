import { useState } from 'react'
import { Search, ArrowLeft, FileText, FileSignature } from 'lucide-react'
import { getOrCreateInvoice } from './invoice'
import { fcfa, fdate } from './utils'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const digits = (s) => String(s ?? '').replace(/\D/g, '')

export default function Clients({ data, openDoc }) {
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState(null)

  const staysOf = (id) => data.bookings.filter((b) => b.client_id === id)
  const valid = (list) => list.filter((b) => b.status !== 'annulee')

  const query = norm(q).trim()
  const compact = query.replace(/\s/g, '')
  const qDigits = digits(q)
  const rows = data.clients.filter((c) =>
    !query ||
    norm(`${c.first_name} ${c.last_name} ${c.last_name} ${c.first_name}`).includes(query) ||
    norm(c.id_number).replace(/\s/g, '').includes(compact) ||
    (qDigits && digits(c.phone).includes(qDigits))
  )

  const client = data.clients.find((c) => c.id === selId)

  if (client) {
    const list = staysOf(client.id)
    const stays = valid(list)
    const spent = stays.reduce((s, b) => s + Number(b.total_amount), 0)
    const invoice = async (b) => {
      const inv = await getOrCreateInvoice(b)
      if (inv) openDoc({ type: 'invoice', booking: b, invoice: inv })
    }
    return (
      <>
        <button className="btn btn-ghost w-fit" onClick={() => setSelId(null)}><ArrowLeft size={16} /> Tous les clients</button>
        <div className="card">
          <h2 className="text-lg font-bold">{client.first_name} {client.last_name}</h2>
          <p className="text-sm text-slate-600">Tél : {client.phone} · Pièce d'identité : {client.id_number}</p>
          <p className="mt-2 text-sm">{stays.length} séjour{stays.length > 1 ? 's' : ''} · Total dépensé <b>{fcfa(spent)}</b></p>
        </div>
        <h3 className="font-bold">Historique des séjours</h3>
        <ul className="space-y-2">
          {list.length === 0 && <li className="card text-sm text-slate-500">Aucun séjour enregistré pour ce client.</li>}
          {list.map((b) => (
            <li key={b.id} className={`card flex flex-wrap items-center justify-between gap-3 ${b.status === 'annulee' ? 'opacity-50' : ''}`}>
              <div>
                <p className="font-semibold">{b.units.name}{b.status === 'annulee' && ' (annulée)'}</p>
                <p className="text-xs text-slate-500">{fdate(b.check_in)} au {fdate(b.check_out)} ({b.nights} nuit{b.nights > 1 ? 's' : ''}) · {b.payment_mode}</p>
                <p className="text-sm">Total {fcfa(b.total_amount)} · <b>Reste {fcfa(b.total_amount - b.advance)}</b></p>
              </div>
              {b.status !== 'annulee' && (
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => invoice(b)}><FileText size={16} /> Facture</button>
                  <button className="btn btn-ghost" onClick={() => openDoc({ type: 'contract', booking: b })}><FileSignature size={16} /> Contrat</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Rechercher par nom, téléphone ou pièce d'identité"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <p className="text-xs text-slate-500">{rows.length} client{rows.length > 1 ? 's' : ''}</p>
      <ul className="space-y-2">
        {rows.length === 0 && <li className="card text-sm text-slate-500">Aucun client ne correspond. Un nouveau client se crée depuis une réservation.</li>}
        {rows.map((c) => {
          const n = valid(staysOf(c.id)).length
          return (
            <li key={c.id}>
              <button onClick={() => setSelId(c.id)} className="card flex w-full items-center justify-between gap-3 text-left hover:border-salam-600">
                <div>
                  <p className="font-semibold">{c.last_name} {c.first_name}</p>
                  <p className="text-xs text-slate-500">{c.phone} · {c.id_number}</p>
                </div>
                <span className="rounded-full bg-salam-50 px-2 py-0.5 text-xs font-medium text-salam-700">{n} séjour{n > 1 ? 's' : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
