import { ArrowLeft, CheckCircle2, Minus, PawPrint, Plus, Search, Trash2, Copy, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../lib/brixly'
import { brl, categories, products, type Category } from '../../lib/data'
import { orderTotal, orderWaLink, type OrderData, type OrderItem } from '../../lib/orders'
import { useSupplierAuth } from '../../lib/supplierAuth'
interface ClientData { nome: string; email: string; telefone: string; documento: string; endereco: string; observacoes: string; fornecedor_id: string }
interface ClientRecord { id: string; data: ClientData; created_at: string }
export default function SupplierNewOrder() {
  const { supplier, loading } = useSupplierAuth()
  const nav = useNavigate()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [clientId, setClientId] = useState('')
  const [cat, setCat] = useState<Category | 'Todos'>('Todos')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ id: string; telefone: string; fornecedorNome: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!supplier) return
    api<{ records: ClientRecord[] }>('db/list', { collection: 'clientes', order: 'desc', limit: 200, filter: { fornecedor_id: supplier.id } }).then((r) => setClients(r.records)).catch(() => {})
  }, [supplier])

  if (!loading && !supplier) return <Navigate to="/fornecedor/entrar" replace />

  const list = useMemo(() => products.filter((p) => (cat === 'Todos' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [cat, q])
  const client = clients.find((c) => c.id === clientId)
  const total = orderTotal(items)

  function addItem(p: (typeof products)[number]) {
    setItems((s) => {
      const key = p.id
      const existing = s.find((i) => i.productId === key)
      if (existing) return s.map((i) => i.productId === key ? { ...i, qty: i.qty + 1 } : i)
      return [...s, { productId: p.id, name: p.name, image: p.images[0], price: p.price, qty: 1, size: p.sizes?.[0], color: p.colors?.[0]?.name }]
    })
  }
  function setQty(productId: string, qty: number) {
    setItems((s) => qty <= 0 ? s.filter((i) => i.productId !== productId) : s.map((i) => i.productId === productId ? { ...i, qty } : i))
  }

  async function createOrder() {
    if (!client || items.length === 0) return
    setSaving(true); setErr('')
    try {
      const data: OrderData = {
        fornecedor_id: supplier!.id, fornecedor_nome: supplier!.name,
        cliente_id: client.id, cliente_nome: client.data.nome, cliente_email: client.data.email, cliente_telefone: client.data.telefone,
        itens: items, total, observacoes: obs, status: 'pendente',
      }
      const r = await api<{ id: string }>('db/create', { collection: 'pedidos_fornecedor', data })
      setCreated({ id: r.id, telefone: client.data.telefone, fornecedorNome: supplier!.name })
    } catch (x) { setErr((x as Error).message) } finally { setSaving(false) }
  }

  if (created) {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}pedido/${created.id}`.replace(/([^:]\/)\/+/g, '$1')
    return (
      <div className="min-h-screen bg-bg">
        <header className="sticky top-0 z-30 border-b border-line bg-bg">
          <div className="wrap flex h-16 items-center"><Link to="/fornecedor" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop <span className="ml-1 text-sm font-normal text-muted">· Fornecedor</span></Link></div>
        </header>
        <main className="wrap grid place-items-center py-24 text-center">
          <CheckCircle2 className="size-12 text-accent" />
          <h1 className="mt-4 text-h2 font-bold">Pedido criado!</h1>
          <p className="mt-2 max-w-md text-muted">Envie o link abaixo para o seu cliente. Ele poderá ver os itens e confirmar o pedido por lá.</p>
          <div className="mt-6 flex w-full max-w-md items-center gap-2 rounded-ui border border-line bg-surface p-3">
            <span className="min-w-0 flex-1 truncate text-sm text-muted">{link}</span>
            <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="grid size-9 shrink-0 place-items-center rounded-ui border border-line hover:border-ink" aria-label="Copiar link"><Copy className="size-4" /></button>
          </div>
          {copied && <p className="mt-2 text-sm text-accent">Link copiado!</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={orderWaLink(created.telefone, created.id, created.fornecedorNome)} target="_blank" rel="noreferrer" className="btn btn-primary"><MessageCircle className="size-4" />Enviar no WhatsApp</a>
            <button onClick={() => nav('/fornecedor')} className="btn btn-ghost">Voltar ao painel</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="wrap flex h-16 items-center justify-between">
          <Link to="/fornecedor" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop <span className="ml-1 text-sm font-normal text-muted">· Fornecedor</span></Link>
          <Link to="/fornecedor" className="btn btn-ghost min-h-[44px]"><ArrowLeft className="size-4" />Voltar</Link>
        </div>
      </header>
      <main className="wrap py-8">
        <p className="eyebrow">Novo pedido</p>
        <h1 className="mt-1 text-h2 font-bold">Montar pedido para um cliente</h1>

        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Cliente</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink">
                <option value="">Selecione um cliente cadastrado</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.data.nome} · {c.data.telefone}</option>)}
              </select>
            </label>
            {clients.length === 0 && <p className="mt-2 text-sm text-muted">Você ainda não cadastrou nenhum cliente. <Link to="/fornecedor" className="underline underline-offset-2">Cadastre um cliente primeiro</Link>.</p>}

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <h2 className="text-h3 font-bold">Itens do pedido</h2>
            {items.length === 0 && <p className="mt-3 text-sm text-muted">Clique nos produtos ao lado para adicionar ao pedido.</p>}
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
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Ex.: prazo de entrega, condição de pagamento…" className="w-full rounded-ui border border-line bg-bg px-3 py-2 text-base outline-none focus:border-ink" />
            </label>
            <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold"><span>Total</span><span className="font-display">{brl(total)}</span></div>
            {err && <p className="mt-2 text-sm text-accent">{err}</p>}
            <button disabled={!client || items.length === 0 || saving} onClick={createOrder} className="btn btn-primary mt-4 w-full disabled:opacity-40">{saving ? 'Criando…' : 'Criar pedido e gerar link'}</button>
          </aside>
        </div>
      </main>
    </div>
  )
}
