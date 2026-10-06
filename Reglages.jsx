import { useState } from 'react'
import { supabase } from './supabase'
import { UNIT_TYPES, UNIT_ZONES } from './utils'

const Field = ({ label, children }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>
)

const emptyUnit = {
  name: '',
  zone: 'Rez-de-chaussée',
  type: 'Chambre simple',
  price_per_night: '0',
  max_guests: '2',
}

export default function Reglages({ data, info, reload }) {
  const [v, setV] = useState({ brand: info.brand, manager: info.manager, phones: info.phones, address: info.address })
  const [newUnit, setNewUnit] = useState(emptyUnit)
  const [msg, setMsg] = useState('')

  const saveInfo = async (e) => {
    e.preventDefault()
    const rows = Object.entries(v).map(([key, value]) => ({ key, value: value.trim() })).filter((r) => r.value)
    const { error } = await supabase.from('settings').upsert(rows)
    setMsg(error ? `Erreur : ${error.message}` : 'Informations enregistrées. Elles apparaissent sur les factures et contrats.')
    reload()
  }

  const addUnit = async (e) => {
    e.preventDefault()
    const name = newUnit.name.trim()
    const price = Number(newUnit.price_per_night) || 0
    const capacity = Math.max(1, Number(newUnit.max_guests) || 1)

    if (!name) {
      setMsg('Le nom du logement est obligatoire.')
      return
    }

    const { error } = await supabase.from('units').insert({
      name,
      zone: newUnit.zone,
      type: newUnit.type,
      price_per_night: price,
      max_guests: capacity,
      status: 'disponible',
    })

    if (error) {
      setMsg(`Erreur : ${error.message}`)
      return
    }

    setNewUnit(emptyUnit)
    setMsg(`${name} a été ajouté avec succès.`)
    reload()
  }

  const saveUnit = async (u, patch) => {
    const { error } = await supabase.from('units').update(patch).eq('id', u.id)
    setMsg(error ? `Erreur : ${error.message}` : `${u.name} mis à jour.`)
    reload()
  }

  return (
    <>
      <form onSubmit={saveInfo} className="card space-y-3">
        <h2 className="font-bold">Établissement</h2>
        <Field label="Nom de l'établissement (affiché sur les documents)">
          <input className="input" value={v.brand} onChange={(e) => setV({ ...v, brand: e.target.value })} />
        </Field>
        <Field label="Nom de la gérante (affiché sur les documents)">
          <input className="input" value={v.manager} onChange={(e) => setV({ ...v, manager: e.target.value })} />
        </Field>
        <Field label="Téléphones"><input className="input" value={v.phones} onChange={(e) => setV({ ...v, phones: e.target.value })} /></Field>
        <Field label="Adresse"><input className="input" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        <button className="btn btn-primary">Enregistrer</button>
      </form>

      <form onSubmit={addUnit} className="card space-y-3">
        <h2 className="font-bold">Ajouter un logement</h2>
        <Field label="Nom du logement">
          <input
            className="input"
            placeholder="Ex. Appartement 15"
            value={newUnit.name}
            onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Zone">
            <select className="input" value={newUnit.zone} onChange={(e) => setNewUnit({ ...newUnit, zone: e.target.value })}>
              {UNIT_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>

          <Field label="Type">
            <select className="input" value={newUnit.type} onChange={(e) => setNewUnit({ ...newUnit, type: e.target.value })}>
              {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prix / nuit (FCFA)">
            <input
              className="input"
              type="number"
              min="0"
              value={newUnit.price_per_night}
              onChange={(e) => setNewUnit({ ...newUnit, price_per_night: e.target.value })}
            />
          </Field>

          <Field label="Capacité (pers.)">
            <input
              className="input"
              type="number"
              min="1"
              value={newUnit.max_guests}
              onChange={(e) => setNewUnit({ ...newUnit, max_guests: e.target.value })}
            />
          </Field>
        </div>

        <button className="btn btn-primary" type="submit">Ajouter le logement</button>
      </form>

      {msg && <p className="rounded-lg bg-salam-50 p-3 text-sm text-salam-700">{msg}</p>}

      <h2 className="pt-2 font-bold">Tarifs et logements</h2>
      <p className="text-xs text-slate-500">Les modifications s'enregistrent automatiquement quand vous quittez le champ.</p>
      <ul className="space-y-2">
        {data.units.map((u) => (
          <li key={`${u.id}-${u.price_per_night}-${u.type}-${u.max_guests}`} className="card grid grid-cols-2 gap-2 sm:grid-cols-4">
            <p className="col-span-2 self-center font-semibold sm:col-span-1">{u.name}</p>
            <select className="input" defaultValue={u.type} onChange={(e) => saveUnit(u, { type: e.target.value })}>
              {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label className="text-xs text-slate-500">Prix / nuit (FCFA)
              <input className="input mt-1" type="number" inputMode="numeric" min="0" defaultValue={u.price_per_night}
                onBlur={(e) => Number(e.target.value) !== Number(u.price_per_night) && saveUnit(u, { price_per_night: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-xs text-slate-500">Capacité (pers.)
              <input className="input mt-1" type="number" inputMode="numeric" min="1" defaultValue={u.max_guests}
                onBlur={(e) => Number(e.target.value) !== Number(u.max_guests) && saveUnit(u, { max_guests: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}
