// Calculs du calendrier. Tout se fait sur des dates "AAAA-MM-JJ" en UTC :
// le jour de la semaine ne dépend donc jamais du fuseau ni de l'heure de l'ordinateur.
import { addDays } from './utils'

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

// "2026-10-11" -> "2026-10"
export const monthOf = (day) => day.slice(0, 7)

// Mois précédent / suivant : shiftMonth('2026-12', 1) -> '2027-01'
export const shiftMonth = (month, n) => {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`
}

// "2026-10" -> "Octobre 2026"
export const monthTitle = (month) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

// Lundi = 0 … Dimanche = 6
export const weekdayIndex = (day) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
export const weekdayName = (day) => WEEKDAYS[weekdayIndex(day)]

// "2026-10-11" -> "Dimanche 11 Octobre 2026"
export const longDate = (day) => {
  const [y, m, d] = day.split('-').map(Number)
  return `${weekdayName(day)} ${d} ${MONTHS[m - 1]} ${y}`
}

// "2026-10-11" -> "11 oct."
export const shortDate = (day) => {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

// Grille du mois : des semaines complètes, du lundi au dimanche.
// Chaque case : { date, day, inMonth }
export const monthGrid = (month) => {
  const first = `${month}-01`
  const start = addDays(first, -weekdayIndex(first))
  const next = shiftMonth(month, 1) + '-01'
  const length = Math.round((new Date(`${next}T00:00:00Z`) - new Date(`${first}T00:00:00Z`)) / 864e5)
  const weeks = Math.ceil((weekdayIndex(first) + length) / 7)
  const cells = []
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i)
    cells.push({ date, day: Number(date.slice(8)), inMonth: date.startsWith(month) })
  }
  return cells
}

// Ce qui se passe un jour donné (les réservations annulées sont ignorées)
//  - arrivals  : arrivent ce jour-là
//  - departures: partent ce jour-là
//  - staying   : déjà là la veille et encore là la nuit suivante
//  - occupied  : logements occupés la nuit de ce jour (arrivées + séjours en cours)
export const dayEvents = (bookings, day) => {
  const live = bookings.filter((b) => b.status !== 'annulee')
  const arrivals = live.filter((b) => b.check_in === day)
  const departures = live.filter((b) => b.check_out === day)
  const staying = live.filter((b) => b.check_in < day && day < b.check_out)
  return { arrivals, departures, staying, occupied: arrivals.length + staying.length }
}
