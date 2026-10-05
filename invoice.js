import { supabase } from './supabase'

// Retourne la facture de la réservation, en la créant si elle n'existe pas encore
export async function getOrCreateInvoice(b) {
  let { data: inv } = await supabase.from('invoices').select('*').eq('booking_id', b.id).maybeSingle()
  if (!inv) {
    const r = await supabase.from('invoices').insert({
      booking_id: b.id,
      label: `Séjour – ${b.units.name} (${b.units.type})`,
      nights: b.nights,
      total: b.total_amount,
      advance: b.advance,
    }).select().single()
    inv = r.data
  }
  return inv
}
