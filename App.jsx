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
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-salam-900 via-salam-800 to-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[28px] border border-white/10 bg-white/95 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-sm">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Connexion</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-salam-700">{GIE.brand}</h1>
        </div>

        <div className="space-y-3">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <button className="btn btn-primary w-full rounded-2xl">Se connecter</button>
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
      <div className={`min-h-screen bg-slate-100 text-slate-900 ${doc ? 'hidden' : ''}`}>
        <header className="sticky top-0 z-20 border-b border-salam-900/10 bg-gradient-to-r from-salam-900 via-salam-800 to-salam-700 text-white shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 md:px-5">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold leading-tight">{info.brand}</p>
              <p className="truncate text-[11px] text-salam-100">Gérante : {info.manager}</p>
            </div>

            <button
              onClick={() => supabase.auth.signOut()}
              aria-label="Se déconnecter"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition hover:bg-white/10"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-4 px-3 pb-28 pt-4 md:px-4">
          {loadErr && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadErr}</p>}
          {page}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_25px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-1">
            {TABS.map(([id, label, Icon]) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition-all ${
                    active
                      ? 'bg-salam-50 text-salam-700 shadow-sm ring-1 ring-salam-100'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
