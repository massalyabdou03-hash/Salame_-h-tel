import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

// ---------- Petits éléments communs à toutes les pages ----------

export const Field = ({ label, hint, className = '', children }) => (
  <label className={`block text-sm ${className}`}>
    <span className="mb-1 block font-medium text-slate-700">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
  </label>
)

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 lg:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Section({ title, hint, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

const TONES = {
  green: ['bg-salam-50 text-salam-700', 'text-slate-900'],
  red: ['bg-red-50 text-red-700', 'text-red-700'],
  amber: ['bg-amber-50 text-amber-700', 'text-amber-800'],
  gold: ['bg-amber-50 text-gold', 'text-slate-900'],
  slate: ['bg-slate-100 text-slate-600', 'text-slate-900'],
}

export function Stat({ label, value, hint, Icon, tone = 'green' }) {
  const [chip, text] = TONES[tone] || TONES.green
  return (
    <div className="card flex items-start gap-3">
      {Icon && (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${chip}`}>
          <Icon size={20} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-0.5 break-words text-xl font-extrabold leading-tight ${text}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

export const Badge = ({ className = 'bg-slate-100 text-slate-700', children }) => (
  <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
)

export const Empty = ({ children }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500">{children}</div>
)

// ---------- Messages et confirmations (remplacent alert() et confirm()) ----------

// Fenêtre par-dessus la page (formulaire, fiche). On la ferme avec la croix ou la touche Échap.
export function Modal({ label, onClose, children, width = 'max-w-3xl' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[data-notify-dialog]')) return // une confirmation est ouverte : elle gère Échap
      onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:p-6"
      role="dialog" aria-modal="true" aria-label={label}
    >
      <div className={`relative mx-auto my-2 w-full ${width}`}>
        {/* Téléphone : barre « Fermer » collée en haut, sous la barre d'état, jamais cachée */}
        <div className="sticky top-0 z-[55] -mt-1 mb-2 flex justify-end sm:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-slate-700 shadow-lg ring-1 ring-slate-300 active:bg-slate-100"
          ><X size={18} /><span className="text-sm font-semibold">Fermer</span></button>
        </div>
        {/* Grand écran : croix sur la fenêtre */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fenêtre"
          className="absolute right-3 top-3 z-10 hidden h-9 w-9 place-items-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 hover:bg-slate-100 sm:grid"
        ><X size={18} /></button>
        {children}
      </div>
    </div>
  )
}

const NotifyContext = createContext(null)

export function useNotify() {
  const ctx = useContext(NotifyContext)
  if (!ctx) throw new Error('useNotify doit être utilisé dans <NotifyProvider>')
  return ctx
}

export function NotifyProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback((message, type = 'success') => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-3), { id, message, type }])
    setTimeout(() => dismiss(id), type === 'error' ? 8000 : 4000)
  }, [dismiss])

  // confirm() renvoie une promesse : true si la personne valide, false sinon
  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ confirmLabel: 'Confirmer', cancelLabel: 'Annuler', danger: false, ...opts, resolve })
  }), [])

  // inform() : un simple message à lire, avec un seul bouton « Compris »
  const inform = useCallback((opts) => new Promise((resolve) => {
    setDialog({ confirmLabel: 'Compris', cancelLabel: null, danger: false, ...opts, resolve })
  }), [])

  const close = (answer) => {
    dialog?.resolve(answer)
    setDialog(null)
  }

  useEffect(() => {
    if (!dialog) return
    const onKey = (e) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <NotifyContext.Provider value={{ toast, confirm, inform }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:inset-x-auto lg:bottom-0 lg:right-0 lg:top-auto lg:items-end lg:p-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border p-3.5 text-sm shadow-lg ${
              t.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {t.type === 'error' ? <AlertCircle size={20} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={20} className="mt-0.5 shrink-0" />}
            <p className="min-w-0 flex-1 font-medium">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Fermer ce message" className="shrink-0 opacity-60 hover:opacity-100"><X size={16} /></button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4" onClick={() => close(false)}>
          <div
            role="dialog"
            aria-modal="true"
            data-notify-dialog
            aria-label={dialog.title}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900">{dialog.title}</h2>
            {dialog.message && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{dialog.message}</p>}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {dialog.cancelLabel && <button className="btn btn-secondary" onClick={() => close(false)}>{dialog.cancelLabel}</button>}
              <button autoFocus className={`btn ${dialog.danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => close(true)}>{dialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </NotifyContext.Provider>
  )
}
