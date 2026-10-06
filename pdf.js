import { jsPDF } from 'jspdf'
import { fcfa, fdate } from './utils'
import { CACHET, SIGNATURE } from './assets'

const GREEN = [31, 77, 58]
const GOLD = [184, 134, 43]
const GREY = [100, 100, 100]
const MM = 0.3528
const m = (n) => fcfa(n).replace(/[\u202f\u00a0]/g, ' ') // espaces insécables non gérés par la police PDF

const newDoc = () => { const d = new jsPDF({ unit: 'mm', format: 'a4' }); d.setLineHeightFactor(1.3); return d }

function header(doc, info, title, sub) {
  doc.setFillColor(...GREEN); doc.rect(0, 0, 210, 6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...GREEN); doc.text(info.brand, 15, 20)
  doc.setFontSize(10); doc.setTextColor(30); doc.text(info.name, 15, 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
  doc.text([`RC : ${info.rc} | NINEA : ${info.ninea}`, info.address, `Tél : ${info.phones}  -  Gérante : ${info.manager}`], 15, 31)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...GOLD); doc.text(title, 195, 20, { align: 'right' })
  doc.setFontSize(10); doc.setTextColor(30); doc.text(sub, 195, 26, { align: 'right' })
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(15, 42, 195, 42)
}

function footer(doc, info) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.8); doc.line(15, 284, 195, 284)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GREY)
    doc.text(`${info.name} - RC ${info.rc} - NINEA ${info.ninea} - ${info.address}`, 105, 289, { align: 'center' })
  }
}

// Écrit un bloc de texte à partir de y (haut), gère le saut de page, renvoie le nouveau y
function flow(doc, y, text, { size = 10, bold = false, color = 30, x = 15, w = 180, gap = 2 } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...[].concat(color))
  const lines = doc.splitTextToSize(text, w)
  const h = lines.length * size * MM * 1.3
  if (y + h > 278) { doc.addPage(); y = 20 }
  doc.text(lines, x, y + size * MM)
  return y + h + gap
}

// Cachet + signature : bloc de 50 mm de large centré sur cx, haut à y. Renvoie la hauteur utilisée.
// Le cachet est en bas, la signature au-dessus à droite (elle ne touche que le haut du cachet).
function seal(doc, cx, y) {
  const W = 50, H = W * 5 / 6
  const sw = 46, sh = sw * CACHET.h / CACHET.w
  const gw = 26, gh = gw * SIGNATURE.h / SIGNATURE.w
  doc.addImage(CACHET.src, 'PNG', cx - sw / 2, y + H - sh, sw, sh)
  doc.addImage(SIGNATURE.src, 'PNG', cx - 5, y, gw, gh)
  return H
}

export function buildInvoice(info, b, inv) {
  const doc = newDoc()
  header(doc, info, 'FACTURE', `N° ${inv.number}`)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30)
  doc.text(`Ziguinchor, le ${fdate(inv.issued_at.slice(0, 10))}`, 195, 49, { align: 'right' })

  let y = flow(doc, 52, 'Client', { size: 11, bold: true, color: GREEN })
  y = flow(doc, y, `${b.clients.first_name} ${b.clients.last_name}\nTél : ${b.clients.phone}\nPièce d'identité : ${b.clients.id_number}`)

  y += 8
  doc.setFillColor(...GREEN); doc.rect(15, y, 180, 8, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('Libellé', 18, y + 5.5); doc.text('Séjour', 112, y + 5.5, { align: 'center' })
  doc.text('Nuitées', 148, y + 5.5, { align: 'center' }); doc.text('Montant total', 192, y + 5.5, { align: 'right' })
  y += 8
  doc.setTextColor(30); doc.setFont('helvetica', 'normal')
  const label = doc.splitTextToSize(inv.label, 62)
  doc.text(label, 18, y + 6)
  doc.text(`${fdate(b.check_in)} au ${fdate(b.check_out)}`, 112, y + 6, { align: 'center' })
  doc.text(String(inv.nights), 148, y + 6, { align: 'center' })
  doc.text(m(inv.total), 192, y + 6, { align: 'right' })
  const rowH = Math.max(11, label.length * 5.5 + 5)
  doc.setDrawColor(200); doc.setLineWidth(0.2); doc.line(15, y + rowH, 195, y + rowH)

  y += rowH + 12
  doc.setFontSize(10)
  doc.text('Montant total', 120, y); doc.text(m(inv.total), 192, y, { align: 'right' })
  doc.text('Avance versée', 120, y + 7); doc.text(m(inv.advance), 192, y + 7, { align: 'right' })
  doc.setFillColor(...GREEN); doc.rect(115, y + 12, 80, 10, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold')
  doc.text('Reste à payer', 120, y + 18.5); doc.text(m(Number(inv.total) - Number(inv.advance)), 192, y + 18.5, { align: 'right' })

  flow(doc, y + 34, `Mode de paiement : ${b.payment_mode}. Modes acceptés : Espèces, Orange Money, Virement, Chèque.`, { size: 9, color: GREY })

  let sy = y + 52
  if (sy > 235) { doc.addPage(); sy = 25 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30)
  doc.text('La direction', 155, sy, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
  doc.text(info.manager, 155, sy + 5, { align: 'center' })
  seal(doc, 155, sy + 8)
  footer(doc, info)
  return doc
}

const RULES = (max) => [
  ['Respect des lieux', "Le client s'engage à user du logement et de son mobilier avec soin et à les restituer en bon état. Toute dégradation est à sa charge."],
  ['Nuisances sonores', 'Le calme doit être respecté à tout moment, notamment la nuit, afin de ne pas troubler les autres occupants et le voisinage.'],
  ['Capacité maximale', `Le nombre d'occupants ne peut pas dépasser la capacité du logement : ${max} personne${max > 1 ? 's' : ''}.`],
  ['Responsabilités', "La direction décline toute responsabilité en cas de perte ou de vol d'effets personnels. Le client répond des dommages causés par lui-même ou ses visiteurs."],
]
export { RULES }

export function buildContract(info, b) {
  const doc = newDoc()
  const balance = Number(b.total_amount) - Number(b.advance)
  header(doc, info, 'CONTRAT DE RÉSERVATION', `Réf. ${b.id.slice(0, 8).toUpperCase()}`)
  let y = flow(doc, 50, `Entre : ${info.name} / ${info.brand}, représenté par ${info.manager}, gérante (le bailleur),`)
  y = flow(doc, y, `Et : ${b.clients.first_name} ${b.clients.last_name}, tél. ${b.clients.phone}, pièce d'identité n° ${b.clients.id_number} (le client).`, { gap: 6 })

  y = flow(doc, y, 'Article 1 - Objet et prix', { size: 11, bold: true, color: GREEN })
  y = flow(doc, y, `Réservation du logement ${b.units.name} (${b.units.type}) du ${fdate(b.check_in)} au ${fdate(b.check_out)}, soit ${b.nights} nuitée${b.nights > 1 ? 's' : ''}.`, { gap: 1 })
  y = flow(doc, y, `- Montant total : ${m(b.total_amount)}`, { gap: 0.5 })
  y = flow(doc, y, `- Avance versée : ${m(b.advance)}`, { gap: 0.5 })
  y = flow(doc, y, `- Solde à payer : ${m(balance)} (${b.payment_mode})`, { gap: 6 })

  y = flow(doc, y, "Article 2 - Conditions d'annulation", { size: 11, bold: true, color: GREEN })
  y = flow(doc, y, "- Annulation 48 h avant l'arrivée : remboursement de 50 % à 100 % des sommes versées.", { gap: 1 })
  y = flow(doc, y, "- Annulation moins de 24 h avant l'arrivée : aucun remboursement.", { gap: 6 })

  y = flow(doc, y, 'Article 3 - Règlement intérieur', { size: 11, bold: true, color: GREEN })
  RULES(b.units.max_guests).forEach(([t, d]) => { y = flow(doc, y, `${t} : ${d}`, { gap: 2.5 }) })

  if (y > 215) { doc.addPage(); y = 20 }
  y += 12
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30)
  doc.text('Le bailleur', 55, y, { align: 'center' }); doc.text('Le client', 155, y, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
  doc.text(info.manager, 55, y + 5, { align: 'center' }); doc.text('« Lu et approuvé »', 155, y + 5, { align: 'center' })
  const sh = seal(doc, 55, y + 8)
  doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(25, y + 9 + sh, 85, y + 9 + sh); doc.line(125, y + 9 + sh, 185, y + 9 + sh)
  footer(doc, info)
  return doc
}

// Partage (WhatsApp, Fichiers…) sur téléphone, téléchargement sinon
export async function sharePdf(doc, filename) {
  const file = new File([doc.output('blob')], filename, { type: 'application/pdf' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return } catch (e) { if (e.name === 'AbortError') return }
  }
  doc.save(filename)
