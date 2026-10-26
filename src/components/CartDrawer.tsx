import { Minus, Plus, Trash2, X } from 'lucide-react'
import { useCart } from '../lib/cart'
import { brl } from '../lib/data'
export default function CartDrawer({ onCheckout }: { onCheckout: () => void }) {
  const { items, open, setOpen, setQty, subtotal, find } = useCart()
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-ink transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`} />
      <aside className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-bg transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-h3">Seu carrinho</h2>
          <button onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-ui hover:bg-surface" aria-label="Fechar"><X className="size-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && <p className="p-6 text-muted">Seu carrinho está vazio. Escolha algo gostoso pro seu pet.</p>}
          {items.map((i) => { const p = find(i.id); return (
            <div key={i.key} className="flex gap-4 border-b border-line p-4">
              <img src={p.images[0]} alt={p.name} className="size-20 shrink-0 rounded-ui object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted">{[i.size, i.color].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center border border-line rounded-ui">
                    <button onClick={() => setQty(i.key, i.qty - 1)} className="grid size-9 place-items-center" aria-label="Diminuir">{i.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}</button>
                    <span className="w-8 text-center">{i.qty}</span>
                    <button onClick={() => setQty(i.key, i.qty + 1)} className="grid size-9 place-items-center" aria-label="Aumentar"><Plus className="size-4" /></button>
                  </div>
                  <span className="font-display font-bold">{brl(p.price * i.qty)}</span>
                </div>
              </div>
            </div>) })}
        </div>
        <footer className="border-t border-line p-4">
          <div className="mb-4 flex justify-between text-lg"><span>Subtotal</span><span className="font-display font-bold">{brl(subtotal)}</span></div>
          <button disabled={!items.length} onClick={() => { setOpen(false); onCheckout() }} className="btn btn-primary w-full disabled:opacity-40">Finalizar compra</button>
        </footer>
      </aside>
    </div>
  )
}
