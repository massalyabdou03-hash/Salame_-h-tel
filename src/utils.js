export const GIE = {
  name: 'GIE SALAM',
  brand: 'MEUBLÉS SALAM',
  rc: 'SN.ZGR.2021.C.1864',
  ninea: '008958657',
  manager: 'Anna NDIAYE',
  address: 'Santhiaba – Ziguinchor (BD 54 Route Kandé)',
  phones: '77 671 18 26 / 77 659 26 11',
}
export const PAY_MODES = ['Espèces', 'Orange Money', 'Virement', 'Chèque', 'Wave']
export const EXPENSE_CATS = ['Plomberie', 'Électricité', 'Maintenance', "Produits d'entretien", 'Équipements', 'Autre']

export const fcfa = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA'
export const iso = (d) => d.toISOString().slice(0, 10)
export const today = () => iso(new Date())
export const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
export const nightsBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5))
export const fdate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-FR') : '')
export const isActive = (b, day) => b.status !== 'annulee' && b.check_in <= day && day < b.check_out
