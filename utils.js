export const GIE = {
  name: 'GIE SALAM',
  brand: 'Salame Hôtel',
  rc: 'SN.ZGR.2021.C.1864',
  ninea: '008958657',
  manager: 'Madame Gniang',
  address: 'Santhiaba – Ziguinchor (BD 54 Route Kandé)',
  phones: '77 671 18 26 / 77 659 26 11',
}
// Valeur enregistrée en base quand le téléphone ou la pièce d'identité n'est pas connu (colonnes obligatoires)
export const NR = 'Non renseigné'
// Vrai si l'information existe vraiment (ni vide, ni « Non renseigné »)
export const known = (v) => { const s = String(v ?? '').trim(); return s !== '' && s !== NR }
export const PAY_MODES =['Espèces', 'Orange Money', 'Virement', 'Chèque', 'Wave']
export const UNIT_ZONES = ['Rez-de-chaussée', 'Étage', 'Duplex', 'Appartement']
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
  terminee: ['Terminé', 'bg-slate-100 text-slate-700'],
  annulee: ['Annulée', 'bg-red-100 text-red-800'],
}

// Origine d'une réservation, avec ses deux couleurs partout dans l'app :
// client direct = vert · pris par un courtier = doré (écrit à la main sans client ni courtier = neutre)
export const sourceOf = (b) => (b.broker_id ? 'courtier' : !b.client_id ? 'note' : 'direct')
export const SOURCE = {
  direct: { label: 'Client direct', bar: 'border-l-4 border-salam-600', pill: 'bg-salam-50 text-salam-800', dot: 'bg-salam-600' },
  courtier: { label: 'Via un courtier', bar: 'border-l-4 border-gold', pill: 'bg-amber-100 text-amber-900', dot: 'bg-gold' },
  note: { label: 'Écrit à la main', bar: 'border-l-4 border-slate-300', pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-300' },
}
// Réservation « bloquée » par un courtier : le logement est réservé mais le client n'est pas encore connu
export const isHold = (b) => !b.client_id
// Nom à afficher pour une réservation (client, ou « Bloqué par … » si le client n'est pas encore connu)
export const clientName = (b) =>
  b.clients ? `${b.clients.first_name} ${b.clients.last_name}`.trim() : isJotted(b) ? b.note.trim() : `Bloqué par ${b.broker_name || 'un courtier'}`
// Prénom + nom court pour les petits espaces (planning)
export const shortName = (b) =>
  b.clients ? `${b.clients.first_name} ${b.clients.last_name}`.trim() : isJotted(b) ? b.note.trim() : `${b.broker_name || 'Courtier'} · client à préciser`
// Case remplie à la main sur le planning : ni client, ni courtier, juste quelques mots écrits
export const isJotted = (b) => !b.client_id && !b.broker_id && Boolean(b.note && b.note.trim())
