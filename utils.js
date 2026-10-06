export const GIE = {
  name: 'GIE SALAM',
  brand: 'Salame Hôtel',
  rc: 'SN.ZGR.2021.C.1864',
  ninea: '008958657',
  manager: 'Madame Gniang',
  address: 'Santhiaba – Ziguinchor (BD 54 Route Kandé)',
  phones: '77 671 18 26 / 77 659 26 11',
}
export const PAY_MODES = ['Espèces', 'Orange Money', 'Virement', 'Chèque']
export const UNIT_TYPES = ['Chambre simple', 'Chambre ventilée', 'Chambre double', 'Duplex', 'Appartement']
export const EXPENSE_CATS = ['Plomberie', 'Électricité', 'Maintenance', "Produits d'entretien", 'Équipements', 'Autre']

export const fcfa = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA'
export const iso = (d) => d.toISOString().slice(0, 10)
export const today = () => iso(new Date())
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
export const nightsBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5))
export const fdate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-FR') : '')
// Une réservation occupe le logement la nuit du jour `day` si arrivée <= jour < départ
export const isActive = (b, day) => b.status !== 'annulee' && b.check_in <= day && day < b.check_out

// État d'une réservation : à venir / en cours / terminée / annulée
export const stageOf = (b, t = today()) =>
  b.status === 'annulee' ? 'annulee' : b.check_out <= t ? 'terminee' : b.check_in > t ? 'avenir' : 'encours'
export const STAGE = {
  avenir: ['À venir', 'bg-sky-100 text-sky-800'],
  encours: ['En cours', 'bg-emerald-100 text-emerald-800'],
  terminee: ['Terminée', 'bg-slate-100 text-slate-700'],
  annulee: ['Annulée', 'bg-red-100 text-red-800'],
}
