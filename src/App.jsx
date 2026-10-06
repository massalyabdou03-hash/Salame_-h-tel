import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, CalendarPlus, Users, Receipt, LogOut } from 'lucide-react'
import { supabase } from './supabase'
import { GIE } from './utils'
import Dashboard from './Dashboard'
import Bookings from './Bookings'
import Expenses from './Expenses'
import Clients from './Clients'
import DocView from './DocView'

const TABS = [
  ['dash', 'Tableau de bord', LayoutDashboard],
  ['res', 'Réservations', CalendarPlus],
  ['cli', 'Clients', Users],
  ['dep', 'Dépenses', Receipt],
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
  const [data, setData] = useState({ units: [], clients: [], bookings: [], expenses: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    const [u, c, b, e] = await Promise.all([
      supabase.from('units').select('*').order('id'),
      supabase.from('clients').select('*').order('last_name'),
      supabase.from('bookings').select('*, clients(*), units(*)').order('check_in', { ascending: false }),
      supabase.from('expenses').select('*, units(name)').order('spent_on', { ascending: false }),
    ])
    setData({ units: u.data ?? [], clients: c.data ?? [], bookings: b.data ?? [], expenses: e.data ?? [] })
  }, [])

  useEffect(() => { if (session) reload() }, [session, reload])

  if (session === undefined) return null
  if (!session) return <Login />

  const page = {
    dash: <Dashboard data={data} reload={reload} />,
    res: <Bookings data={data} reload={reload} openDoc={setDoc} />,
    cli: <Clients data={data} openDoc={setDoc} />,
    dep: <Expenses data={data} reload={reload} />,
  }[tab]

  return (
    <>
    {doc && <DocView doc={doc} onClose={() => setDoc(null)} />}
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${doc ? 'hidden' : ''}`}>
      <header className="flex items-center justify-between bg-salam-700 px-4 py-3 text-white">
        <div>
          <p className="font-bold leading-tight">{GIE.brand}</p>
          <p className="text-xs text-salam-100">Gérante : {GIE.manager}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} aria-label="Se déconnecter"><LogOut size={20} /></button>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-white md:static md:justify-center md:gap-2 md:border-b md:border-t-0 md:py-2">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs md:flex-none md:flex-row md:gap-2 md:rounded-lg md:px-4 md:text-sm ${tab === id ? 'font-semibold text-salam-700 md:bg-salam-50' : 'text-slate-600 md:hover:bg-slate-100'}`}
          >
            <Icon size={20} />{label}
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-5xl space-y-4 p-4 pb-24 md:pb-6">{page}</main>
    </div>
    </>
  )
}
