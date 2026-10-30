import { useState } from 'react'
import { BellRing, X } from 'lucide-react'

// Rappel de paiement de l'abonnement de la base de données.
// S'affiche uniquement l'avant-dernier et le dernier jour du mois.
// Si on le ferme, il revient le lendemain (s'il est encore dans la période).
const MONTANT = '11 500 F'

function cleDuJour() {
  const d = new Date()
  return `rappel-abonnement-ferme-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function estFinDeMois() {
  const now = new Date()
  const dernierJour = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return now.getDate() >= dernierJour - 1
}

function dejaFerme() {
  try { return !!localStorage.getItem(cleDuJour()) } catch { return false }
}

export default function RappelAbonnement() {
  const [visible, setVisible] = useState(() => estFinDeMois() && !dejaFerme())
  if (!visible) return null

  const fermer = () => {
    try { localStorage.setItem(cleDuJour(), '1') } catch { /* stockage indisponible */ }
    setVisible(false)
  }

  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300 border-l-[6px] border-l-amber-500 bg-amber-50 p-4 text-amber-900 shadow-sm">
      <BellRing size={22} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1 space-y-1 text-sm">
        <p className="font-bold">Rappel : abonnement de la base de données</p>
        <p>
          Le mois se termine. Merci d'envoyer les <b>{MONTANT}</b> de l'abonnement mensuel à Massaly pour que l'application continue de fonctionner.
        </p>
      </div>
      <button type="button" onClick={fermer} aria-label="Fermer le rappel" className="rounded-full p-1 text-amber-700 transition hover:bg-amber-100">
        <X size={18} />
      </button>
    </div>
  )
}
