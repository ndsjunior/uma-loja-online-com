import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '../lib/cart'
import { brl } from '../lib/data'
export default function ProductPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { find, add } = useCart()
  const p = find(id)
  const [img, setImg] = useState(0)
  const [size, setSize] = useState(p.sizes?.[0])
  const [color, setColor] = useState(p.colors?.[0].name)
  return (
    <section className="wrap py-8">
      <button onClick={onBack} className="btn btn-ghost mb-6"><ArrowLeft className="size-4" />Voltar à vitrine</button>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <img src={p.images[img]} alt={p.name} className="aspect-square w-full rounded-ui object-cover" />
          <div className="mt-3 flex gap-3">
            {p.images.map((s, i) => (
              <button key={i} onClick={() => setImg(i)} className={`size-20 overflow-hidden rounded-ui border-2 ${i === img ? 'border-accent' : 'border-line'}`}><img src={s} alt="" className="size-full object-cover" /></button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="border-b border-line pb-6">
            <p className="eyebrow">{p.category}</p>
            <h1 className="mt-2 text-h2 font-bold">{p.name}</h1>
            <p className="mt-4">{p.oldPrice && <span className="mr-2 text-muted line-through">{brl(p.oldPrice)}</span>}<span className="font-display text-h2 font-bold">{brl(p.price)}</span></p>
            <p className="mt-4 max-w-prose text-muted">{p.description}</p>
          </div>
          {p.sizes && <div><p className="mb-2 font-medium">Tamanho</p><div className="flex flex-wrap gap-2">
            {p.sizes.map((s) => <button key={s} onClick={() => setSize(s)} className={`min-h-[44px] min-w-[56px] rounded-ui border px-4 ${size === s ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink'}`}>{s}</button>)}
          </div></div>}
          {p.colors && <div><p className="mb-2 font-medium">Cor: <span className="text-muted">{color}</span></p><div className="flex gap-3">
            {p.colors.map((c) => <button key={c.name} onClick={() => setColor(c.name)} aria-label={c.name} className={`size-11 rounded-full border-2 p-1 ${color === c.name ? 'border-ink' : 'border-line'}`}><span className={`block size-full rounded-full ${c.swatch}`} /></button>)}
          </div></div>}
          <button onClick={() => add(p, size, color)} className="btn btn-primary w-full"><ShoppingBag className="size-5" />Adicionar ao carrinho</button>
        </div>
      </div>
    </section>
  )
}
