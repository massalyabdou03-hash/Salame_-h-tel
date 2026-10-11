import { useState } from 'react'
import { supabase } from './supabase'
import { UNIT_TYPES, UNIT_ZONES } from './utils'
import { Field, PageHeader, Section, useNotify } from './ui'

const emptyUnit = {
  name: '',
  zone: 'Rez-de-chaussée',
  type: 'Chambre simple',
  price_per_night: '0',
  max_guests: '2',
}

export default function Reglages({ data, info, reload }) {
  const { toast, confirm } = useNotify()
  const [v, setV] = useState({ brand: info.brand, manager: info.manager, phones: info.phones, address: info.address })
  const [newUnit, setNewUnit] = useState(emptyUnit)

  const fail = (error) => toast(`Cela n'a pas pu être enregistré : ${error.message}`, 'error')

  const saveInfo = async (e) => {
    e.preventDefault()
    const rows = Object.entries(v).map(([key, value]) => ({ key, value: value.trim() })).filter((r) => r.value)
    const { error } = await supabase.from('settings').upsert(rows)
    if (error) return fail(error)
    toast('Les informations sont enregistrées. Elles apparaissent sur les factures et les contrats.')
    reload()
  }

  const addUnit = async (e) => {
    e.preventDefault()
    const name = newUnit.name.trim()
    const price = Number(newUnit.price_per_night) || 0
    const capacity = Math.max(1, Number(newUnit.max_guests) || 1)

    if (!name) return toast('Écrivez le nom du logement.', 'error')

    const { error } = await supabase.from('units').insert({
      name,
      zone: newUnit.zone,
      type: newUnit.type,
      price_per_night: price,
      max_guests: capacity,
      status: 'disponible',
    })
    if (error) return fail(error)

    setNewUnit(emptyUnit)
    toast(`Le logement « ${name} » a été ajouté.`)
    reload()
  }

  const deleteUnit = async (u) => {
    const ok = await confirm({
      title: 'Supprimer ce logement ?',
      message: `« ${u.name} » sera supprimé de la liste. Cette action est définitive.`,
      confirmLabel: 'Oui, supprimer',
      cancelLabel: 'Non, le garder',
      danger: true,
    })
    if (!ok) return

    const { error } = await supabase.from('units').delete().eq('id', u.id)
    if (error) {
      return toast(
        error.code === '23503'
          ? `« ${u.name} » a encore des réservations ou des dépenses : il ne peut pas être supprimé.`
          : `La suppression n'a pas pu être faite : ${error.message}`,
        'error'
      )
    }
    toast(`Le logement « ${u.name} » a été supprimé.`)
    reload()
  }

  const saveUnit = async (u, patch) => {
    const { error } = await supabase.from('units').update(patch).eq('id', u.id)
    if (error) return fail(error)
    toast(`« ${u.name} » a été mis à jour.`)
    reload()
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Réglages" subtitle="Les informations de l'hôtel et la liste des logements" />

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={saveInfo} className="card space-y-4 self-start">
          <div>
            <h2 className="text-lg font-bold">Établissement</h2>
            <p className="text-sm text-slate-500">Ces informations sont écrites sur les factures et les contrats.</p>
          </div>
          <Field label="Nom de l'hôtel">
            <input className="input" value={v.brand} onChange={(e) => setV({ ...v, brand: e.target.value })} />
          </Field>
          <Field label="Nom de la gérante">
            <input className="input" value={v.manager} onChange={(e) => setV({ ...v, manager: e.target.value })} />
          </Field>
          <Field label="Téléphones"><input className="input" value={v.phones} onChange={(e) => setV({ ...v, phones: e.target.value })} /></Field>
          <Field label="Adresse"><input className="input" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <button className="btn btn-primary btn-lg">Enregistrer</button>
        </form>

        <form onSubmit={addUnit} className="card space-y-4 self-start">
          <h2 className="text-lg font-bold">Ajouter un logement</h2>
          <Field label="Nom du logement">
            <input
              className="input"
              placeholder="Ex. Appartement 15"
              value={newUnit.name}
              onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
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

            <Field label="Prix par nuit (FCFA)">
              <input
                className="input"
                type="number"
                min="0"
                value={newUnit.price_per_night}
                onChange={(e) => setNewUnit({ ...newUnit, price_per_night: e.target.value })}
              />
            </Field>

            <Field label="Nombre de personnes">
              <input
                className="input"
                type="number"
                min="1"
                value={newUnit.max_guests}
                onChange={(e) => setNewUnit({ ...newUnit, max_guests: e.target.value })}
              />
            </Field>
          </div>

          <button className="btn btn-primary btn-lg" type="submit">Ajouter le logement</button>
        </form>
      </div>

      <Section title="Tarifs et logements" hint="Changez un prix ou une capacité, puis cliquez en dehors du champ : c'est enregistré automatiquement.">
        <ul className="space-y-3">
          {data.units.map((u) => (
            <li key={`${u.id}-${u.price_per_night}-${u.type}-${u.max_guests}`} className="card grid grid-cols-2 items-end gap-3 !p-4 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]">
              <p className="col-span-2 self-center text-base font-bold lg:col-span-1">{u.name}</p>
              <Field label="Type">
                <select className="input" defaultValue={u.type} onChange={(e) => saveUnit(u, { type: e.target.value })}>
                  {UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Prix par nuit (FCFA)">
                <input className="input" type="number" inputMode="numeric" min="0" defaultValue={u.price_per_night}
                  onBlur={(e) => Number(e.target.value) !== Number(u.price_per_night) && saveUnit(u, { price_per_night: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Nombre de personnes">
                <input className="input" type="number" inputMode="numeric" min="1" defaultValue={u.max_guests}
                  onBlur={(e) => Number(e.target.value) !== Number(u.max_guests) && saveUnit(u, { max_guests: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
              <button type="button" className="btn btn-danger col-span-2 lg:col-span-1" onClick={() => deleteUnit(u)}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
