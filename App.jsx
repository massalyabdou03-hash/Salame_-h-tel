import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, CalendarPlus, FileText, Users, Receipt, Handshake, Settings, LogOut, Hotel, MoreHorizontal } from 'lucide-react'
import { supabase } from './supabase'
import { GIE } from './utils'
import { NotifyProvider, Field } from './ui'
import Dashboard from './Dashboard'
import Bookings from './Bookings'
import Proformas from './Proformas'
import Clients from './Clients'
import Expenses from './Expenses'
import Courtiers from './Courtiers'
import Reglages from './Reglages'
import DocView from './DocView'

const TABS = [
  ['dash', 'Accueil', LayoutDashboard],
  ['res', 'Réservations', CalendarPlus],
  ['pro', 'Proformas', FileText],
  ['cli', 'Clients', Users],
  ['dep', 'Dépenses', Receipt],
  ['cou', 'Courtiers', Handshake],
  ['set', 'Réglages', Settings],
]

// Pages de tous les jours (menu du bas) et pages plus rares (rangées dans « Plus »)
const MAIN_IDS = ['dash', 'res', 'cli']
const MAIN = TABS.filter(([id]) => MAIN_IDS.includes(id))
const OTHER = TABS.filter(([id]) => !MAIN_IDS.includes(id))

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(error.status === 429 ? 'Trop de tentatives. Attendez une minute puis réessayez.' : 'Email ou mot de passe incorrect. Vérifiez et réessayez.')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-salam-900 via-salam-800 to-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-white p-7 shadow-2xl shadow-slate-950/30">
        <div className="space-y-2 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-salam-700 text-white"><Hotel size={28} /></span>
          <h1 className="text-2xl font-extrabold tracking-tight text-salam-700">{GIE.brand}</h1>
          <p className="text-sm text-slate-500">Connectez-vous pour gérer l'hôtel</p>
        </div>

        <div className="space-y-4">
          <Field label="Adresse email">
            <input className="input" type="email" autoComplete="username" placeholder="exemple@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Mot de passe">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        </div>

        {err && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <button className="btn btn-primary btn-lg w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  )
}

function Shell() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('dash')
  const [more, setMore] = useState(false) // feuille « Plus » du menu du bas
  const [doc, setDoc] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [newReq, setNewReq] = useState(null) // demande de nouvelle réservation depuis l'accueil : { date }
  const [focusId, setFocusId] = useState(null) // réservation à montrer dans la page Réservations
  const [data, setData] = useState({ units: [], clients: [], bookings: [], expenses: [], brokers: [], brokersAll: [], archivedIds: [], proformas: [], settings: {} })

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
      supabase.from('brokers').select('*').order('name'),
      supabase.from('proformas').select('*').order('created_at', { ascending: false }),
    ])

    const failed = res.find((r) => r.error)
    setLoadErr(failed ? `Chargement impossible : ${failed.error.message}` : '')
    const [u, c, b, e, s, br, pf] = res
    let archived = []
    try { const v = JSON.parse((s.data ?? []).find((r) => r.key === 'brokers_archived')?.value || '[]'); if (Array.isArray(v)) archived = v.map(Number) } catch { /* liste illisible : on ignore */ }
    setData({
      units: u.data ?? [],
      clients: c.data ?? [],
      // Nom du courtier ajouté à chaque réservation (sert à afficher « Bloqué par … »)
      bookings: (b.data ?? []).map((x) => ({ ...x, broker_name: (br.data ?? []).find((y) => y.id === x.broker_id)?.name ?? null })),
      expenses: e.data ?? [],
      // Courtiers retirés de la liste : cachés des choix, mais gardés avec leur historique
      brokers: (br.data ?? []).filter((x) => !archived.includes(x.id)),
      brokersAll: br.data ?? [],
      archivedIds: archived,
      proformas: pf.data ?? [],
      settings: Object.fromEntries((s.data ?? []).map((r) => [r.key, r.value])),
    })
  }, [])

  // On recharge les données seulement quand l'utilisateur change (connexion / déconnexion),
  // pas à chaque renouvellement du jeton, sinon on boucle et Supabase bloque (erreur 429).
  const userId = session?.user?.id

  useEffect(() => {
    if (userId) reload()
  }, [userId, reload])

  if (session === undefined) return null
  if (!session) return <Login />

  const info = { ...GIE, ...Object.fromEntries(Object.entries(data.settings).filter(([k, v]) => v && k !== 'brokers_archived')) }

  // Ouvre la page Réservations avec le formulaire de nouvelle réservation (date facultative)
  const goNew = (date, extra) => {
    setNewReq({ date: date || null, ...(extra || {}) })
    setTab('res')
    window.scrollTo({ top: 0 })
  }

  // Ouvre la page Réservations sur une réservation précise
  const goBooking = (id) => {
    setFocusId(id)
    setTab('res')
    window.scrollTo({ top: 0 })
  }

  const page = {
    dash: <Dashboard data={data} reload={reload} goNew={goNew} goBooking={goBooking} />,
    res: <Bookings data={data} reload={reload} openDoc={setDoc} startNew={newReq} onStarted={() => setNewReq(null)} goPro={() => setTab('pro')} focusId={focusId} onFocused={() => setFocusId(null)} />,
    pro: <Proformas data={data} reload={reload} openDoc={setDoc} goNew={goNew} />,
    cli: <Clients data={data} openDoc={setDoc} reload={reload} />,
    dep: <Expenses data={data} reload={reload} />,
    cou: <Courtiers data={data} reload={reload} />,
    set: <Reglages data={data} info={info} reload={reload} />,
  }[tab]

  return (
    <>
      {doc && <DocView doc={doc} info={info} onClose={() => setDoc(null)} />}
      <div className={`min-h-screen bg-slate-100 text-slate-900 ${doc ? 'hidden' : ''}`}>
        {/* Grand écran : menu à gauche */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-salam-900 to-salam-800 text-white lg:flex">
          <div className="px-6 pb-6 pt-7">
            <p className="text-xl font-extrabold leading-tight">{info.brand}</p>
            <p className="mt-1 text-xs text-salam-100">Gérante : {info.manager}</p>
          </div>
          <nav className="flex-1 space-y-1 px-3" aria-label="Menu principal">
            {[...MAIN, null, ...OTHER].map((item) => {
              // null = séparateur entre les pages de tous les jours et les pages plus rares
              if (!item) return <p key="sep" className="px-4 pb-1 pt-5 text-[11px] font-bold uppercase tracking-wider text-salam-100/70">Autres</p>
              const [id, label, Icon] = item
              const active = tab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-colors ${
                    active ? 'bg-white text-salam-700 shadow-sm' : 'text-salam-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={20} /> {label}
                </button>
              )
            })}
          </nav>
          <div className="p-3">
            <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold text-salam-100 hover:bg-white/10 hover:text-white">
              <LogOut size={20} /> Se déconnecter
            </button>
          </div>
        </aside>

        {/* Téléphone / tablette : bandeau en haut */}
        <header className="sticky top-0 z-20 border-b border-salam-900/10 bg-gradient-to-r from-salam-900 via-salam-800 to-salam-700 pt-[env(safe-area-inset-top)] text-white shadow-sm lg:hidden">
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

        <main className="mx-auto max-w-[1280px] space-y-6 px-3 pb-28 pt-4 md:px-5 lg:pb-12 lg:pl-[calc(16rem+2rem)] lg:pr-8 lg:pt-8">
          {loadErr && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadErr}</p>}
          {page}
        </main>

        {/* Feuille « Plus » : les pages qu'on ouvre rarement */}
        {more && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMore(false)}>
            <div className="absolute inset-0 bg-slate-900/40" />
            <div
              role="dialog"
              aria-label="Autres pages"
              className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mx-3 space-y-1 rounded-3xl bg-white p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {OTHER.map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setMore(false); window.scrollTo({ top: 0 }) }}
                  aria-current={tab === id ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-base font-semibold transition-colors ${
                    tab === id ? 'bg-salam-50 text-salam-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={22} /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-[45] border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_25px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden" aria-label="Menu principal">
          <div className="mx-auto flex max-w-5xl items-center gap-1">
            {[...MAIN, ['more', 'Plus', MoreHorizontal]].map(([id, label, Icon]) => {
              const isMore = id === 'more'
              // « Plus » est allumé quand on est sur une des pages rangées dedans (ou quand la feuille est ouverte)
              const active = isMore ? more || OTHER.some(([o]) => o === tab) : !more && tab === id
              return (
                <button
                  key={id}
                  onClick={() => (isMore ? setMore(!more) : (setMore(false), setTab(id)))}
                  aria-current={active && !isMore ? 'page' : undefined}
                  aria-expanded={isMore ? more : undefined}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-salam-50 text-salam-700 shadow-sm ring-1 ring-salam-100'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={22} />
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

export default function App() {
  return (
    <NotifyProvider>
      <Shell />
    </NotifyProvider>
  )
}
