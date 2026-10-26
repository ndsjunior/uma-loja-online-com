import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/brixly'
import { useCart } from '../lib/cart'
import { brl } from '../lib/data'
const F = ({ label, name, type = 'text' }: { label: string; name: string; type?: string }) => (
  <label className="flex flex-col gap-1"><span className="text-sm font-medium">{label}</span>
    <input required name={name} type={type} className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink" /></label>)
export default function Checkout({ onBack }: { onBack: () => void }) {
  const { items, subtotal, find, clear } = useCart()
  const [done, setDone] = useState(false), [loading, setLoading] = useState(false), [err, setErr] = useState('')
  const frete = subtotal >= 199 || subtotal === 0 ? 0 : 19.9
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setErr('')
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await api('db/create', { collection: 'pedidos', notify: true, data: { ...data, itens: items.map((i) => `${i.qty}x ${find(i.id).name} ${[i.size, i.color].filter(Boolean).join('/')}`).join('; '), total: subtotal + frete } })
      clear(); setDone(true)
    } catch (x) { setErr((x as Error).message) } finally { setLoading(false) }
  }
  if (done) return <section className="wrap grid place-items-center py-24 text-center"><CheckCircle2 className="size-12 text-accent" /><h1 className="mt-4 text-h2 font-bold">Pedido recebido!</h1><p className="mt-2 text-muted">Vamos entrar em contato para confirmar o pagamento e a entrega.</p><button onClick={onBack} className="btn btn-primary mt-8">Continuar comprando</button></section>
  return (
    <section className="wrap py-8">
      <button onClick={onBack} className="btn btn-ghost mb-6"><ArrowLeft className="size-4" />Voltar à loja</button>
      <div className="grid gap-10 lg:grid-cols-12">
        <form onSubmit={submit} className="flex flex-col gap-4 lg:col-span-7">
          <h1 className="text-h2 font-bold">Finalizar compra</h1>
          <div className="grid gap-4 sm:grid-cols-2"><F label="Nome completo" name="nome" /><F label="E-mail" name="email" type="email" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><F label="Telefone" name="telefone" type="tel" /><F label="CEP" name="cep" /></div>
          <F label="Endereço e número" name="endereco" />
          <label className="flex flex-col gap-1"><span className="text-sm font-medium">Pagamento</span>
            <select name="pagamento" className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base"><option>Pix</option><option>Cartão de crédito</option><option>Boleto</option></select></label>
          {err && <p className="text-accent">{err}</p>}
          <button disabled={loading || !items.length} className="btn btn-primary w-full disabled:opacity-40">{loading ? 'Enviando…' : 'Confirmar pedido'}</button>
        </form>
        <aside className="h-fit rounded-ui border border-line bg-surface p-6 lg:col-span-5">
          <h2 className="text-h3 font-bold">Resumo do pedido</h2>
          <ul className="mt-4 divide-y divide-line">
            {items.map((i) => { const p = find(i.id); return <li key={i.key} className="flex gap-3 py-3"><img src={p.images[0]} alt="" className="size-14 rounded-ui object-cover" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{i.qty}× {p.name}</p><p className="text-sm text-muted">{[i.size, i.color].filter(Boolean).join(' · ')}</p></div><span className="text-sm font-medium">{brl(p.price * i.qty)}</span></li> })}
          </ul>
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Frete</span><span>{frete ? brl(frete) : 'Grátis'}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><span>Total</span><span className="font-display">{brl(subtotal + frete)}</span></div>
          </div>
        </aside>
      </div>
    </section>
  )
}
