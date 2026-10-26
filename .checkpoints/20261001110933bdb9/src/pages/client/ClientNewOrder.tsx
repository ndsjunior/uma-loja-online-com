import { CheckCircle2, LogOut, Minus, PackageSearch, PawPrint, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../lib/brixly'
import { clearClientEmail, getClientEmail } from '../../lib/clientSession'
import { brl, categories, products, type Category } from '../../lib/data'
import { orderTotal, type OrderData, type OrderItem } from '../../lib/orders'
interface ClientData { nome: string; email: string; telefone: string; documento: string; endereco: string; observacoes: string; fornecedor_id: string }
interface ClientRecord { id: string; data: ClientData; created_at: string }
interface SupplierInfo { id: string; name: string }
export default function ClientNewOrder() {
  const nav = useNavigate()
  const email = getClientEmail()
  const [client, setClient] = useState<ClientRecord | null>(null)
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cat, setCat] = useState<Category | 'Todos'>('Todos')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!email) return
    api<{ records: ClientRecord[] }>('db/list', { collection: 'clientes', limit: 5, filter: { email } })
      .then(async (r) => {
        if (r.records.length === 0) { setNotFound(true); return }
        const c = r.records[0]
        setClient(c)
        try {
          const s = await api<{ user: SupplierInfo }>('auth/me')
          setSupplier(s.user)
        } catch { setSupplier({ id: c.data.fornecedor_id, name: 'Petshop' }) }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [email])

  if (!email) return <Navigate to="/meus-pedidos/entrar" replace />

  const list = useMemo(() => products.filter((p) => (cat === 'Todos' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [cat, q])
  const total = orderTotal(items)

  function addItem(p: (typeof products)[number]) {
    setItems((s) => {
      const existing = s.find((i) => i.productId === p.id)
      if (existing) return s.map((i) => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...s, { productId: p.id, name: p.name, image: p.images[0], price: p.price, qty: 1, size: p.sizes?.[0], color: p.colors?.[0]?.name }]
    })
  }
  function setQty(productId: string, qty: number) {
    setItems((s) => qty <= 0 ? s.filter((i) => i.productId !== productId) : s.map((i) => i.productId === productId ? { ...i, qty } : i))
  }

  async function submitOrder() {
    if (!client || items.length === 0) return
    setSaving(true); setErr('')
    try {
      const data: OrderData = {
        fornecedor_id: client.data.fornecedor_id, fornecedor_nome: supplier?.name || 'Petshop',
        cliente_id: client.id, cliente_nome: client.data.nome, cliente_email: client.data.email, cliente_telefone: client.data.telefone,
        itens: items, total, observacoes: obs, status: 'pendente',
      }
      const r = await api<{ id: string }>('db/create', { collection: 'pedidos_fornecedor', notify: true, data })
      setDone(r.id)
    } catch (x) { setErr((x as Error).message) } finally { setSaving(false) }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><p className="text-muted">Carregando…</p></div>

  if (notFound) {
    return (
      <div className="min-h-screen bg-bg">
        <header className="border-b border-line"><div className="wrap flex h-16 items-center"><Link to="/" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop</Link></div></header>
        <main className="wrap grid place-items-center py-24 text-center">
          <PackageSearch className="size-10 text-muted" />
          <p className="mt-4 text-h3 font-bold">Cadastro não encontrado</p>
          <p className="mt-2 max-w-sm text-muted">Não encontramos um cadastro de cliente com esse e-mail. Fale com seu fornecedor.</p>
          <Link to="/meus-pedidos/entrar" className="btn btn-primary mt-8">Tentar outro e-mail</Link>
        </main>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-bg">
        <header className="border-b border-line"><div className="wrap flex h-16 items-center"><Link to="/" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop</Link></div></header>
        <main className="wrap grid place-items-center py-24 text-center">
          <CheckCircle2 className="size-12 text-accent" />
          <h1 className="mt-4 text-h2 font-bold">Pedido enviado!</h1>
          <p className="mt-2 max-w-md text-muted">Seu pedido foi enviado para {supplier?.name || 'o fornecedor'}. Você pode acompanhar o status a qualquer momento.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={`/pedido/${done}`} className="btn btn-primary">Ver meu pedido</Link>
            <Link to="/meus-pedidos" className="btn btn-ghost">Ver todos os pedidos</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="wrap flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop</Link>
          <div className="flex items-center gap-3">
            <Link to="/meus-pedidos" className="btn btn-ghost min-h-[44px]">Meus pedidos</Link>
            <button onClick={() => { clearClientEmail(); nav('/') }} className="btn btn-ghost min-h-[44px]"><LogOut className="size-4" />Sair</button>
          </div>
        </div>
      </header>
      <main className="wrap py-8">
        <p className="eyebrow">Olá, {client?.data.nome.split(' ')[0]}</p>
        <h1 className="mt-1 text-h2 font-bold">Monte seu pedido</h1>
        <p className="mt-2 text-muted">Escolha os produtos que deseja, confira o total e envie o pedido para {supplier?.name || 'o fornecedor'}.</p>

        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(['Todos', ...categories] as const).map((c) => (
                  <button key={c} onClick={() => setCat(c)} className={`min-h-[44px] shrink-0 rounded-ui border px-4 transition ${cat === c ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink'}`}>{c}</button>
                ))}
              </div>
              <label className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="min-h-[44px] w-full rounded-ui border border-line bg-bg pl-10 pr-3 text-base outline-none focus:border-ink" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map((p) => (
                <button key={p.id} onClick={() => addItem(p)} className="group flex flex-col rounded-ui border border-line p-3 text-left hover:border-ink">
                  <div className="overflow-hidden rounded-ui"><img src={p.images[0]} alt={p.name} loading="lazy" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" /></div>
                  <span className="mt-2 text-sm font-medium">{p.name}</span>
                  <span className="mt-1 font-display font-bold text-accent">{brl(p.price)}</span>
                  <span className="mt-2 flex items-center justify-center gap-1 rounded-ui bg-ink py-1.5 text-xs font-medium text-bg"><Plus className="size-3" />Adicionar</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-ui border border-line bg-surface p-6 lg:col-span-5">
            <h2 className="text-h3 font-bold">Seu pedido</h2>
            {items.length === 0 && <p className="mt-3 text-sm text-muted">Clique nos produtos ao lado para montar seu pedido.</p>}
            <ul className="mt-4 divide-y divide-line">
              {items.map((i) => (
                <li key={i.productId} className="flex gap-3 py-3">
                  <img src={i.image} alt="" className="size-14 shrink-0 rounded-ui object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{i.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex items-center rounded-ui border border-line">
                        <button onClick={() => setQty(i.productId, i.qty - 1)} className="grid size-8 place-items-center" aria-label="Diminuir">{i.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}</button>
                        <span className="w-7 text-center text-sm">{i.qty}</span>
                        <button onClick={() => setQty(i.productId, i.qty + 1)} className="grid size-8 place-items-center" aria-label="Aumentar"><Plus className="size-3.5" /></button>
                      </div>
                      <span className="text-sm font-medium">{brl(i.price * i.qty)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-4 flex flex-col gap-1">
              <span className="text-sm font-medium">Observações (opcional)</span>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Ex.: horário de entrega, alguma preferência…" className="w-full rounded-ui border border-line bg-bg px-3 py-2 text-base outline-none focus:border-ink" />
            </label>
            <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold"><span>Total</span><span className="font-display">{brl(total)}</span></div>
            {err && <p className="mt-2 text-sm text-accent">{err}</p>}
            <button disabled={items.length === 0 || saving} onClick={submitOrder} className="btn btn-primary mt-4 w-full disabled:opacity-40"><ShoppingCart className="size-4" />{saving ? 'Enviando…' : 'Enviar pedido'}</button>
          </aside>
        </div>
      </main>
    </div>
  )
}
