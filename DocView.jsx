import { Printer, ArrowLeft, Share2, Download } from 'lucide-react'
import { fcfa, fdate } from './utils'
import { buildInvoice, buildContract, sharePdf, RULES } from './pdf'
import { CACHET, SIGNATURE } from './assets'

function Header({ info, title, subtitle }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b-4 border-salam-700 pb-4">
      <div>
        <h1 className="text-2xl font-extrabold text-salam-700">{info.brand}</h1>
        <p className="text-sm font-semibold">{info.name}</p>
        <p className="text-xs text-slate-600">RC : {info.rc} | NINEA : {info.ninea}</p>
        <p className="text-xs text-slate-600">{info.address}</p>
        <p className="text-xs text-slate-600">Tél : {info.phones} · Gérante : {info.manager}</p>
      </div>
      <div className="text-right">
        <h2 className="text-xl font-bold text-gold">{title}</h2>
        <p className="text-sm">{subtitle}</p>
      </div>
    </header>
  )
}

// Cachet + signature de la gérante : le cachet en bas, la signature au-dessus à droite
function Seal({ className = '' }) {
  return (
    <div className={`relative mx-auto mt-2 aspect-[6/5] w-full max-w-[15rem] ${className}`}>
      <img src={CACHET.src} alt="Cachet" className="absolute bottom-0 left-1/2 w-[92%] -translate-x-1/2" />
      <img src={SIGNATURE.src} alt="Signature" className="absolute left-[40%] top-0 w-[52%]" />
    </div>
  )
}

function Invoice({ info, b, inv }) {
  const balance = Number(inv.total) - Number(inv.advance)
  return (
    <>
      <Header info={info} title="FACTURE" subtitle={`N° ${inv.number}`} />
      <p className="mt-2 text-right text-xs">Ziguinchor, le {fdate(inv.issued_at.slice(0, 10))}</p>
      <section className="mt-4 text-sm">
        <p className="font-semibold text-salam-700">Client</p>
        <p>{b.clients.first_name} {b.clients.last_name} — Tél : {b.clients.phone}</p>
        <p>Pièce d'identité : {b.clients.id_number}</p>
      </section>
      <table className="mt-6 w-full text-sm">
        <thead className="bg-salam-700 text-white">
          <tr><th className="p-2 text-left">Libellé</th><th className="p-2">Séjour</th><th className="p-2">Nuitées</th><th className="p-2 text-right">Montant total</th></tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-2">{inv.label}</td>
            <td className="p-2 text-center">{fdate(b.check_in)} au {fdate(b.check_out)}</td>
            <td className="p-2 text-center">{inv.nights}</td>
            <td className="p-2 text-right">{fcfa(inv.total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-72 space-y-1 text-sm">
        <p className="flex justify-between"><span>Montant total</span><b>{fcfa(inv.total)}</b></p>
        <p className="flex justify-between"><span>Avance versée</span><b>{fcfa(inv.advance)}</b></p>
        <p className="flex justify-between rounded bg-salam-700 p-2 text-white"><span>Reste à payer</span><b>{fcfa(balance)}</b></p>
      </div>
      <p className="mt-6 text-xs text-slate-600">Mode de paiement : {b.payment_mode}. Modes acceptés : Espèces, Orange Money, Virement, Chèque.</p>
      <div className="ml-auto mt-8 w-64 break-inside-avoid text-center text-sm">
        <p className="font-semibold">La direction</p>
        <p className="text-xs text-slate-500">{info.manager}</p>
        <Seal />
      </div>
    </>
  )
}

function Contract({ info, b }) {
  const balance = Number(b.total_amount) - Number(b.advance)
  return (
    <>
      <Header info={info} title="CONTRAT DE RÉSERVATION" subtitle={`Réf. ${b.id.slice(0, 8).toUpperCase()}`} />
      <section className="mt-4 space-y-1 text-sm">
        <p><b>Entre :</b> {info.name} / {info.brand}, représenté par {info.manager}, gérante (le bailleur),</p>
        <p><b>Et :</b> {b.clients.first_name} {b.clients.last_name}, tél. {b.clients.phone}, pièce d'identité n° {b.clients.id_number} (le client).</p>
      </section>
      <h3 className="mt-5 font-bold text-salam-700">Article 1 — Objet et prix</h3>
      <p className="text-sm">
        Réservation du logement <b>{b.units.name}</b> ({b.units.type}) du {fdate(b.check_in)} au {fdate(b.check_out)}, soit {b.nights} nuitée{b.nights > 1 ? 's' : ''}.
        Montant total : <b>{fcfa(b.total_amount)}</b> · Avance versée : <b>{fcfa(b.advance)}</b> · Solde à payer : <b>{fcfa(balance)}</b> ({b.payment_mode}).
      </p>
      <h3 className="mt-5 font-bold text-salam-700">Article 2 — Conditions d'annulation</h3>
      <ul className="list-disc pl-5 text-sm">
        <li>Annulation 48 h avant l'arrivée : remboursement de 50 % à 100 % des sommes versées.</li>
        <li>Annulation moins de 24 h avant l'arrivée : aucun remboursement.</li>
      </ul>
      <h3 className="mt-5 font-bold text-salam-700">Article 3 — Règlement intérieur</h3>
      <ul className="space-y-1 text-sm">{RULES(b.units.max_guests).map(([t, d]) => <li key={t}><b>{t} :</b> {d}</li>)}</ul>
      <div className="mt-10 grid grid-cols-2 gap-8 break-inside-avoid text-center text-sm">
        <div>
          <p className="font-semibold">Le bailleur</p>
          <p className="text-xs text-slate-500">{info.manager}</p>
          <Seal className="border-b" />
        </div>
        <div>
          <p className="font-semibold">Le client</p>
          <p className="text-xs text-slate-500">« Lu et approuvé »</p>
          <div className="mx-auto mt-2 aspect-[6/5] w-full max-w-[15rem] border-b" />
        </div>
      </div>
    </>
  )
}

export default function DocView({ doc, info, onClose }) {
  const { type, booking: b, invoice } = doc
  const make = () => (type === 'invoice' ? buildInvoice(info, b, invoice) : buildContract(info, b))
  const filename = (type === 'invoice' ? `Facture-${invoice.number}` : `Contrat-${b.clients.last_name}-${b.units.name}`).replace(/[^\w-]+/g, '_') + '.pdf'
  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap gap-2 bg-salam-900 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] print:hidden">
        <button className="btn bg-white text-slate-800" onClick={onClose}><ArrowLeft size={16} /> Retour</button>
        <button className="btn btn-gold" onClick={() => sharePdf(make(), filename)}><Share2 size={16} /> Partager / Enregistrer PDF</button>
        <button className="btn bg-white text-slate-800" onClick={() => make().save(filename)}><Download size={16} /> Télécharger</button>
        <button className="btn hidden bg-white text-slate-800 md:inline-flex" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
      </div>
      <article className="mx-auto my-4 max-w-[210mm] bg-white p-5 shadow md:p-10 print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {type === 'invoice' ? <Invoice info={info} b={b} inv={invoice} /> : <Contract info={info} b={b} />}
        <footer className="mt-10 border-t-4 border-salam-700 pt-2 text-center text-xs text-slate-500">
          {info.name} · RC {info.rc} · NINEA {info.ninea} · {info.address}
        </footer>
      </article>
    </div>
  )
}
