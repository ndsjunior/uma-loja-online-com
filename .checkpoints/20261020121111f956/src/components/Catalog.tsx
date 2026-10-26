import { Search, ShieldCheck, Star, Truck, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { brl, categories, products, type Category } from '../lib/data'
const perks = [
  { icon: Truck, title: 'Frete grátis acima de R$ 199', text: 'Para todo o Brasil, em compras elegíveis.' },
  { icon: ShieldCheck, title: 'Compra segura', text: 'Pagamento protegido e dados criptografados.' },
  { icon: Undo2, title: 'Troca em até 7 dias', text: 'Não gostou? A gente resolve rapidinho.' },
]
export default function Catalog(_props: { onOpen: (id: string) => void }) {
  const [cat, setCat] = useState<Category | 'Todos'>('Todos')
  const [q, setQ] = useState('')
  const list = useMemo(() => products.filter((p) => (cat === 'Todos' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [cat, q])
  return (
    <>
      <section className="border-b border-line">
        <div className="wrap grid gap-8 py-12 md:py-20 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="eyebrow">Pet shop online</p>
            <h1 className="mt-4 text-h1 font-bold">Higiene e conforto para o seu pet, entregue em casa.</h1>
            <p className="mt-4 max-w-prose text-lead text-muted">Areias sanitárias, tapetes higiênicos, sanitários e brinquedos para cães e gatos, com {products.length} produtos selecionados e entrega rápida.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#vitrine" className="btn btn-primary">Ver produtos</a>
              <Link to="/meus-pedidos/entrar" className="btn btn-primary">Pedidos</Link>
              <Link to="/fornecedor/entrar" className="btn btn-primary">Fornecedores</Link>
            </div>
          </div>
          <img src="https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&q=80" alt="Cachorro feliz" className="hidden aspect-[4/5] w-full rounded-ui object-cover lg:col-span-4 lg:block" />
        </div>
      </section>
      <section className="wrap border-b border-line py-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {perks.map((p) => (
            <div key={p.title} className="flex items-start gap-3">
              <p.icon className="size-6 shrink-0 text-accent" strokeWidth={1.75} />
              <div className="min-w-0"><p className="font-medium">{p.title}</p><p className="text-sm text-muted">{p.text}</p></div>
            </div>
          ))}
        </div>
      </section>
      <section id="vitrine" className="wrap py-10">
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
            <Link key={p.id} to="/meus-pedidos/entrar" className="group flex flex-col border-b border-r border-line p-3 text-left md:p-5">
              <div className="relative overflow-hidden rounded-ui">
                <img src={p.images[0]} alt={p.name} loading="lazy" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
                {p.badge && <span className="absolute left-2 top-2 rounded-ui bg-sun px-2 py-1 text-xs font-bold text-sun-ink">{p.badge}</span>}
              </div>
              <span className="mt-3 text-xs uppercase tracking-wider text-muted">{p.category}</span>
              <span className="mt-1 font-medium group-hover:text-accent">{p.name}</span>
              <span className="mt-1 flex items-center gap-1 text-xs text-muted"><Star className="size-3.5 fill-sun text-sun" />{p.rating.toFixed(1)} · {p.reviews} avaliações</span>
              <span className="mt-auto pt-2">
                <span className="font-display text-lg font-bold text-transparent select-none">{brl(p.price)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
