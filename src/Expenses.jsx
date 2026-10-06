import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { supabase } from './supabase'

export default function Expenses({ data, reload }) {
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!desc || !amount || !unit) return
    setLoading(true)
    const { error } = await supabase.from('expenses').insert([
      { description: desc, amount: parseFloat(amount), unit_id: unit, spent_on: date }
    ])
    if (!error) {
      setDesc('')
      setAmount('')
      setUnit('')
      setDate(new Date().toISOString().split('T')[0])
      reload()
    }
    setLoading(false)
  }

  const remove = async (id) => {
    if (confirm('Supprimer cette dépense ?')) {
      await supabase.from('expenses').delete().eq('id', id)
      reload()
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold">Ajouter une dépense</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="input"
            type="text"
            placeholder="Description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="Montant"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
          >
            <option value="">Sélectionner une unité</option>
            {data.units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary mt-3 w-full md:w-auto">
          <Plus size={16} />
          Ajouter
        </button>
      </form>

      <div className="space-y-2">
        {data.expenses.map((exp) => (
          <div key={exp.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow">
            <div>
              <p className="font-medium">{exp.description}</p>
              <p className="text-xs text-slate-500">
                {exp.units?.name} • {new Date(exp.spent_on).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-semibold">{exp.amount.toFixed(2)} DH</p>
              <button
                onClick={() => remove(exp.id)}
                className="text-red-600 hover:text-red-700"
                aria-label="Supprimer"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
