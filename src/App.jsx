import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, CalendarPlus, Users, Receipt, Settings, LogOut } from 'lucide-react'
import { supabase } from './supabase'
import { GIE } from './utils'
import Dashboard from './Dashboard'
import Bookings from './Bookings'
import Clients from './Clients'
import Expenses from './Expenses'
import Reglages from './Reglages'
import DocView from './DocView'

const TABS = [
  ['dash', 'Accueil', LayoutDashboard],
  ['res', 'Réservations', CalendarPlus],
  ['cli', 'Clients', Users],
  ['dep', 'Dépenses', Receipt],
  ['set', 'Réglages', Settings],
]

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('Email ou mot de passe incorrect.')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-salam-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6">
        <h1 className="text-xl font-bold text-salam-700">{GIE.brand}</h1>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn btn-primary w-full">Se connecter</button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('dash')
  const [doc, setDoc] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [data, setData] = useState({ units: [], clients: [], bookings: [], expenses: [], settings: {} })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    const res = await Promise.all([
      supabase.from('units').select('*').order('id'),
      supabase.from('clients').select('*').order('last_name'),
      supabase.from('bookings').select('*, clients(*), units(*)').order('check_in', { ascending: false }),
      supabase.from('expenses').select('*, units(name)').order('spent_on', { ascending: false }),
      supabase.from('settings').select('*'),
    ])

    const failed = res.find((r) => r.error)
    setLoadErr(failed ? `Chargement impossible : ${failed.error.message}` : '')
    const [u, c, b, e, s] = res
    setData({
      units: u.data ?? [],
      clients: c.data ?? [],
      bookings: b.data ?? [],
      expenses: e.data ?? [],
      settings: Object.fromEntries((s.data ?? []).map((r) => [r.key, r.value])),
    })
  }, [])

  useEffect(() => {
    if (session) reload()
  }, [session, reload])

  if (session === undefined) return null
  if (!session) return <Login />

  const info = { ...GIE, ...Object.fromEntries(Object.entries(data.settings).filter(([, v]) => v)) }

  const page = {
    dash: <Dashboard data={data} reload={reload} />,
    res: <Bookings data={data} reload={reload} openDoc={setDoc} />,
    cli: <Clients data={data} openDoc={setDoc} />,
    dep: <Expenses data={data} reload={reload} />,
    set: <Reglages data={data} info={info} reload={reload} />,
  }[tab]

  return (
    <>
      {doc && <DocView doc={doc} info={info} onClose={() => setDoc(null)} />}
      <div className={`min-h-screen bg-slate-50 text-slate-900 ${doc ? 'hidden' : ''}`}>
        <header className="flex items-center justify-between bg-salam-700 px-4 py-3 text-white">
          <div>
            <p className="font-bold leading-tight">{info.brand}</p>
            <p className="text-xs text-salam-100">Gérante : {info.manager}</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} aria-label="Se déconnecter"><LogOut size={20} /></button>
        </header>

        <main className="mx-auto max-w-5xl space-y-4 p-4 pb-28">
          {loadErr && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadErr}</p>}
          {page}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white shadow-lg gap-1 p-2">
          {TABS.map(([id, label, Icon]) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[10px] font-semibold transition-all ${
                  active
                    ? 'bg-salam-100 text-salam-700 shadow-sm ring-1 ring-salam-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
