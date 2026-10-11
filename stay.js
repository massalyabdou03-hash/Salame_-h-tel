import { supabase } from './supabase'
import { useNotify } from './ui'

// Les heures sont affichées à l'heure de Dakar, quelle que soit l'heure réglée sur l'ordinateur
const DAKAR = { timeZone: 'Africa/Dakar' }
export const dakarDay = (ts) => new Date(ts).toLocaleDateString('sv-SE', DAKAR)
export const dakarDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', DAKAR)
export const dakarTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { ...DAKAR, hour: '2-digit', minute: '2-digit' })

const who = (b) => `${b.clients?.first_name ?? ''} ${b.clients?.last_name ?? ''}`.trim()

// Enregistrer l'heure d'arrivée / de départ d'un client.
// L'heure est fixée par le serveur au moment du clic : elle ne dépend pas de l'ordinateur.
export function useStayActions(reload) {
  const { toast, confirm } = useNotify()

  const stamp = async (b, field, on) => {
    const { data, error } = await supabase
      .from('bookings')
      .update({ [field]: on ? new Date().toISOString() : null })
      .eq('id', b.id)
      .select('checked_in_at, checked_out_at')
      .single()
    if (error) {
      toast(
        error.message.includes('bookings_stay_order')
          ? "Enregistrez d'abord l'arrivée du client, ou annulez son départ avant d'annuler son arrivée."
          : `L'heure n'a pas pu être enregistrée : ${error.message}`,
        'error'
      )
      return false
    }
    return data
  }

  const arrive = async (b) => {
    const data = await stamp(b, 'checked_in_at', true)
    if (!data) return
    toast(`Arrivée de ${who(b)} enregistrée à ${dakarTime(data.checked_in_at)}.`)
    reload()
  }

  const leave = async (b) => {
    const data = await stamp(b, 'checked_out_at', true)
    if (!data) return
    toast(`Départ de ${who(b)} enregistré à ${dakarTime(data.checked_out_at)}.`)
    reload()
  }

  const undo = async (b, field) => {
    const arrival = field === 'checked_in_at'
    const ok = await confirm({
      title: arrival ? "Annuler l'heure d'arrivée ?" : "Annuler l'heure de départ ?",
      message: `${who(b)} : l'heure enregistrée sera effacée. Vous pourrez l'enregistrer de nouveau, mais ce sera avec l'heure du moment.`,
      confirmLabel: 'Oui, effacer',
      cancelLabel: 'Non, la garder',
      danger: true,
    })
    if (!ok) return
    const data = await stamp(b, field, false)
    if (!data) return
    toast(arrival ? "L'heure d'arrivée a été effacée." : "L'heure de départ a été effacée.")
    reload()
  }

  return { arrive, leave, undo }
}
