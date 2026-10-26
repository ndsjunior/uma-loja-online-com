import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { brl, categories, products, type Category } from '../lib/data'
export default function Catalog({ onOpen }: { onOpen: (id: string) => void }) {
  const [cat, setCat] = useState<Category | 'Todos'>('Todos')
  const [q, setQ] = useState('')
  const list = useMemo(() => products.filter((p) => (cat === 'Todos' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [cat, q])
  return (
    <>
            <section id="vitrine" className="panel-solid border-t border-line"><div className="wrap py-16 md:py-24">
        <p className="eyebrow">Vitrine</p><h2 className="mb-8 mt-3 text-h1 font-bold">Escolha o que seu pet merece</h2>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['Todos', ...categories] as const).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`min-h-[44px] shrink-0 rounded-ui border px-4 transition ${cat === c ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink'}`}>{c}</button>
            ))}
          </div>
          <label className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="min-h-[44px] w-full rounded-ui border border-line bg-bg pl-10 pr-3 text-base outline-none focus:border-ink" />
          </label>
        </div>
        {list.length === 0 && <p className="py-16 text-muted">Nenhum produto encontrado para essa busca.</p>}
        <div className="mt-8 grid grid-cols-2 border-l border-t border-line md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <button key={p.id} onClick={() => onOpen(p.id)} className="group flex flex-col border-b border-r border-line p-3 text-left md:p-5">
              <div className="overflow-hidden rounded-ui"><img src={p.images[0]} alt={p.name} loading="lazy" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" /></div>
              <span className="mt-3 text-xs uppercase tracking-wider text-muted">{p.category}</span>
              <span className="mt-1 font-medium group-hover:text-accent">{p.name}</span>
              <span className="mt-auto pt-2">
                {p.oldPrice && <span className="mr-2 block text-sm text-muted line-through">{brl(p.oldPrice)}</span>}
                <span className="font-display text-lg font-bold text-accent">{brl(p.price)}</span>
              </span>
            </button>
          ))}
        </div>
      </div></section>
    </>
  )
}
