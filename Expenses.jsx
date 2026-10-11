import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import { EXPENSE_CATS, fcfa, fdate, today } from './utils'
import { Field, PageHeader, Empty, useNotify } from './ui'

export default function Expenses({ data, reload }) {
  const { toast, confirm } = useNotify()
  const [f, setF] = useState({ category: EXPENSE_CATS[0], amount: '', unit_id: '', description: '', spent_on: today() })
  const [cat, setCat] = useState('')
  const [month, setMonth] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const add = async (e) => {
    e.preventDefault()
    setErr('')
    const amount = Number(f.amount)
    if (!f.category) return setErr('Choisissez une catégorie.')
    if (!amount || amount <= 0) return setErr('Écrivez un montant supérieur à 0.')
    setBusy(true)
    // Charge utile explicite : chaque colonne est envoyée avec une valeur sûre
    const { error } = await supabase.from('expenses').insert({
      category: f.category,
      amount,
      unit_id: f.unit_id ? Number(f.unit_id) : null,
      description: f.description.trim() || null,
      spent_on: f.spent_on || today(),
    })
    setBusy(false)
    if (error) return setErr(`La dépense n'a pas pu être enregistrée : ${error.message}`)
    toast(`La dépense de ${fcfa(amount)} a été enregistrée.`)
    setF({ ...f, amount: '', description: '', unit_id: '' })
    reload()
  }

  const remove = async (x) => {
    const ok = await confirm({
      title: 'Supprimer cette dépense ?',
      message: `${x.category}${x.units?.name ? ` — ${x.units.name}` : ''} : ${fcfa(x.amount)}, le ${fdate(x.spent_on)}.\n\nCette action est définitive.`,
      confirmLabel: 'Oui, supprimer',
      cancelLabel: 'Non, la garder',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('expenses').delete().eq('id', x.id)
    if (error) return toast(`La suppression n'a pas pu être faite : ${error.message}`, 'error')
    toast('La dépense a été supprimée.')
    reload()
  }

  const rows = data.expenses.filter((x) => (!cat || x.category === cat) && (!month || x.spent_on.startsWith(month)))
  const total = rows.reduce((s, x) => s + Number(x.amount), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Dépenses" subtitle="Notez ce que l'hôtel dépense (réparations, produits, etc.)" />

      <form onSubmit={add} className="card space-y-4">
        <h2 className="text-lg font-bold">Ajouter une dépense</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Catégorie">
            <select className="input" value={f.category} onChange={set('category')}>
              {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Montant (FCFA)"><input className="input" type="number" inputMode="numeric" min="1" required value={f.amount} onChange={set('amount')} /></Field>
          <Field label="Logement concerné (facultatif)">
            <select className="input" value={f.unit_id} onChange={set('unit_id')}>
              <option value="">Aucun</option>
              {data.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Date de la dépense"><input className="input" type="date" required value={f.spent_on} onChange={set('spent_on')} /></Field>
        </div>
        <Field label="Détail (facultatif)"><input className="input" placeholder="Ex. Robinet de la chambre 3" value={f.description} onChange={set('description')} /></Field>
        {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la dépense'}</button>
      </form>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Catégorie">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes</option>{EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Mois"><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <p className="ml-auto text-sm">Total : <b className="text-xl text-red-700">{fcfa(total)}</b></p>
      </div>

      <ul className="space-y-2">
        {rows.length === 0 && <li><Empty>Aucune dépense pour ce choix.</Empty></li>}
        {rows.map((x) => (
          <li key={x.id} className="card flex items-center justify-between gap-3 !p-4">
            <div className="min-w-0">
              <p className="font-semibold">{x.category}{x.units?.name && ` — ${x.units.name}`}</p>
              <p className="text-xs text-slate-500">{fdate(x.spent_on)}{x.description && ` · ${x.description}`}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <b className="text-red-700">− {fcfa(x.amount)}</b>
              <button onClick={() => remove(x)} aria-label={`Supprimer la dépense ${x.category}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={18} /></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
