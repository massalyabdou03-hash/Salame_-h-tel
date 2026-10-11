import { useState } from 'react'
import { Search, ArrowLeft, FileText, FileSignature, Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import { getOrCreateInvoice } from './invoice'
import { fcfa, fdate } from './utils'
import { PageHeader, Empty, Badge, useNotify } from './ui'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const digits = (s) => String(s ?? '').replace(/\D/g, '')

export default function Clients({ data, openDoc, reload }) {
  const { toast, confirm, inform } = useNotify()
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState(null)

  const staysOf = (id) => data.bookings.filter((b) => b.client_id === id)
  const valid = (list) => list.filter((b) => b.status !== 'annulee')

  // Recherche : nom/prénom (sans accents), pièce d'identité, ou téléphone (espaces ignorés)
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
      else toast("La facture n'a pas pu être créée. Vérifiez la connexion internet et réessayez.", 'error')
    }
    // Un client qui a des réservations (même annulées) ne peut pas être supprimé : il faut d'abord supprimer ses réservations
    const removeClient = async () => {
      if (list.length > 0) {
        await inform({
          title: 'Suppression impossible',
          message: `${client.first_name} ${client.last_name} a encore ${list.length} réservation${list.length > 1 ? 's' : ''} (même annulée${list.length > 1 ? 's' : ''}). Supprimez-${list.length > 1 ? 'les' : 'la'} d'abord dans la page Réservations.`,
        })
        return
      }
      const ok = await confirm({
        title: 'Supprimer ce client ?',
        message: `${client.first_name} ${client.last_name} sera supprimé définitivement. Cette action est définitive.`,
        confirmLabel: 'Oui, supprimer',
        cancelLabel: 'Non, le garder',
        danger: true,
      })
      if (!ok) return
      const { error } = await supabase.from('clients').delete().eq('id', client.id)
      if (error) {
        return toast(error.code === '23503' ? 'Impossible : ce client a encore des réservations.' : `La suppression n'a pas pu être faite : ${error.message}`, 'error')
      }
      toast('Le client a été supprimé.')
      setSelId(null)
      reload?.()
    }

    return (
      <div className="space-y-6">
        <button className="btn btn-secondary w-fit" onClick={() => setSelId(null)}><ArrowLeft size={16} /> Tous les clients</button>
        <div className="card">
          <h1 className="text-2xl font-extrabold">{client.first_name} {client.last_name}</h1>
          <p className="text-sm text-slate-600">Téléphone : {client.phone} · Pièce d'identité : {client.id_number}</p>
          <p className="mt-2 text-sm">{stays.length} séjour{stays.length > 1 ? 's' : ''} · Total dépensé <b>{fcfa(spent)}</b></p>
        </div>
        <h2 className="text-lg font-bold">Historique des séjours</h2>
        <ul className="space-y-3">
          {list.length === 0 && <li><Empty>Aucun séjour enregistré pour ce client.</Empty></li>}
          {list.map((b) => (
            <li key={b.id} className={`card flex flex-wrap items-center justify-between gap-3 !p-4 ${b.status === 'annulee' ? 'opacity-50' : ''}`}>
              <div>
                <p className="font-semibold">{b.units.name}{b.status === 'annulee' && ' (annulée)'}</p>
                <p className="text-xs text-slate-500">{fdate(b.check_in)} au {fdate(b.check_out)} ({b.nights} nuit{b.nights > 1 ? 's' : ''}) · {b.payment_mode}</p>
                <p className="text-sm">Total {fcfa(b.total_amount)} · <b>Reste {fcfa(b.total_amount - b.advance)}</b></p>
              </div>
              {b.status !== 'annulee' && (
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => invoice(b)}><FileText size={16} /> Facture</button>
                  <button className="btn btn-secondary" onClick={() => openDoc({ type: 'contract', booking: b })}><FileSignature size={16} /> Contrat</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-1 pt-2">
          <button className="btn btn-danger w-fit" onClick={removeClient}><Trash2 size={16} /> Supprimer ce client</button>
          {list.length > 0 && <p className="text-xs text-slate-500">Pour supprimer ce client, supprimez d'abord ses réservations.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" subtitle="Cherchez un client pour voir tous ses séjours">
        <p className="text-sm font-medium text-slate-600">{rows.length} client{rows.length > 1 ? 's' : ''}</p>
      </PageHeader>
      <div className="relative max-w-xl">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder="Rechercher par nom, téléphone ou pièce d'identité"
          aria-label="Rechercher un client"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {rows.length === 0 && <Empty>Aucun client ne correspond. Un nouveau client se crée depuis une réservation.</Empty>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((c) => {
          const n = valid(staysOf(c.id)).length
          return (
            <li key={c.id}>
              <button onClick={() => setSelId(c.id)} className="card flex w-full items-center justify-between gap-3 !p-4 text-left transition-colors hover:border-salam-600 hover:bg-salam-50/40">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.last_name} {c.first_name}</p>
                  <p className="truncate text-xs text-slate-500">{c.phone} · {c.id_number}</p>
                </div>
                <Badge className="bg-salam-50 text-salam-700">{n} séjour{n > 1 ? 's' : ''}</Badge>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
