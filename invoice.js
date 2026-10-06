import { supabase } from './supabase'

// Retourne la facture de la réservation (créée si besoin) et la met à jour si la réservation a changé
export async function getOrCreateInvoice(b) {
  const fields = {
    label: `Séjour – ${b.units.name} (${b.units.type})`,
    nights: b.nights,
    total: b.total_amount,
    advance: b.advance,
  }
  const { data: inv } = await supabase.from('invoices').select('*').eq('booking_id', b.id).maybeSingle()
  if (!inv) {
    const r = await supabase.from('invoices').insert({ booking_id: b.id, ...fields }).select().single()
    return r.data
  }
  const stale = inv.label !== fields.label || inv.nights !== fields.nights ||
    Number(inv.total) !== Number(fields.total) || Number(inv.advance) !== Number(fields.advance)
  if (!stale) return inv
  const r = await supabase.from('invoices').update(fields).eq('id', inv.id).select().single()
  return r.data ?? inv
}
