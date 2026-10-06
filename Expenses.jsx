import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import { EXPENSE_CATS, fcfa, fdate, today } from './utils'

const Field = ({ label, children }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>
)

export default function Expenses({ data, reload }) {
  const [f, setF] = useState({ category: EXPENSE_CATS[0], amount: '', unit_id: '', description: '', spent_on: today() })
  const [cat, setCat] = useState('')
  const [month, setMonth] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const add = async (e) => {
    e.preventDefault()
    setErr(''); setOk('')
    const amount = Number(f.amount)
    if (!f.category) return setErr('Choisissez une catégorie.')
    if (!amount || amount <= 0) return setErr('Saisissez un montant supérieur à 0.')
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
    if (error) return setErr(`Échec de l'enregistrement : ${error.message}`)
    setOk('Dépense enregistrée.')
    setF({ ...f, amount: '', description: '', unit_id: '' })
    reload()
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette dépense ?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return alert(error.message)
    reload()
  }

  const rows = data.expenses.filter((x) => (!cat || x.category === cat) && (!month || x.spent_on.startsWith(month)))
  const total = rows.reduce((s, x) => s + Number(x.amount), 0)

  return (
    <>
      <form onSubmit={add} className="card space-y-3">
        <h2 className="font-bold">Ajouter une dépense</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Catégorie">
            <select className="input" value={f.category} onChange={set('category')}>
              {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Montant (FCFA)"><input className="input" type="number" inputMode="numeric" min="1" required value={f.amount} onChange={set('amount')} /></Field>
          <Field label="Logement concerné (optionnel)">
            <select className="input" value={f.unit_id} onChange={set('unit_id')}>
              <option value="">Aucun</option>
              {data.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input className="input" type="date" required value={f.spent_on} onChange={set('spent_on')} /></Field>
        </div>
        <Field label="Description"><input className="input" value={f.description} onChange={set('description')} /></Field>
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        {ok && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{ok}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la dépense'}</button>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Filtrer par catégorie">
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Toutes</option>{EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Mois"><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <p className="ml-auto text-sm">Total cumulé : <b className="text-lg text-red-700">{fcfa(total)}</b></p>
      </div>

      <ul className="space-y-2">
        {rows.length === 0 && <li className="card text-sm text-slate-500">Aucune dépense pour ce filtre.</li>}
        {rows.map((x) => (
          <li key={x.id} className="card flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{x.category}{x.units?.name && ` — ${x.units.name}`}</p>
              <p className="text-xs text-slate-500">{fdate(x.spent_on)}{x.description && ` · ${x.description}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <b>{fcfa(x.amount)}</b>
              <button onClick={() => remove(x.id)} aria-label="Supprimer" className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
