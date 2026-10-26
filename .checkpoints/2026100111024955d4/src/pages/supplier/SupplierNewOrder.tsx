import { ArrowLeft, CheckCircle2, Copy, MessageCircle, Minus, PawPrint, Plus, Search, Trash2, X } from 'lucide-react'
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
  const [cat, setCat] = useState<Category | 'Todos'>('Todos')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ id: string; telefone: string; fornecedorNome: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [clientQ, setClientQ] = useState('')
  const [clientId, setClientId] = useState('')

  useEffect(() => {
    if (!supplier) return
    api<{ records: ClientRecord[] }>('db/list', { collection: 'clientes', order: 'desc', limit: 200, filter: { fornecedor_id: supplier.id } }).then((r) => setClients(r.records)).catch(() => {})
  }, [supplier])

  const list = useMemo(() => products.filter((p) => (cat === 'Todos' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [cat, q])
  const clientList = useMemo(() => clients.filter((c) => [c.data.nome, c.data.telefone, c.data.email].join(' ').toLowerCase().includes(clientQ.toLowerCase())), [clients, clientQ])
  const total = orderTotal(items)

  if (!loading && !supplier) return <Navigate to="/fornecedor/entrar" replace />

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

  function openClientPicker() {
    if (items.length === 0) return
    setClientQ(''); setClientId(''); setErr(''); setPickOpen(true)
  }

  async function confirmClientAndSend() {
    const client = clients.find((c) => c.id === clientId)
    if (!client || items.length === 0) return
    setSaving(true); setErr('')
    try {
      const data: OrderData = {
        fornecedor_id: supplier!.id, fornecedor_nome: supplier!.name,
        cliente_id: client.id, cliente_nome: client.data.nome, cliente_email: client.data.email, cliente_telefone: client.data.telefone,
        itens: items, total, observacoes: obs, status: 'pendente',
      }
      const r = await api<{ id: string }>('db/create', { collection: 'pedidos_fornecedor', data })
      setPickOpen(false)
      setCreated({ id: r.id, telefone: client.data.telefone, fornecedorNome: supplier!.name })
      window.open(orderWaLink(client.data.telefone, r.id, supplier!.name), '_blank')
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
          <h1 className="mt-4 text-h2 font-bold">Pedido enviado!</h1>
          <p className="mt-2 max-w-md text-muted">Abrimos o WhatsApp com o link do pedido pronto para enviar ao seu cliente.</p>
          <div className="mt-6 flex w-full max-w-md items-center gap-2 rounded-ui border border-line bg-surface p-3">
            <span className="min-w-0 flex-1 truncate text-sm text-muted">{link}</span>
            <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="grid size-9 shrink-0 place-items-center rounded-ui border border-line hover:border-ink" aria-label="Copiar link"><Copy className="size-4" /></button>
          </div>
          {copied && <p className="mt-2 text-sm text-accent">Link copiado!</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={orderWaLink(created.telefone, created.id, created.fornecedorNome)} target="_blank" rel="noreferrer" className="btn btn-primary"><MessageCircle className="size-4" />Abrir WhatsApp de novo</a>
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
        <h1 className="mt-1 text-h2 font-bold">Escolha os produtos do pedido</h1>
        <p className="mt-2 text-muted">Adicione os itens e, ao finalizar, informe para qual cliente é o pedido.</p>

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
            <button disabled={items.length === 0} onClick={openClientPicker} className="btn btn-primary mt-4 w-full disabled:opacity-40"><MessageCircle className="size-4" />Finalizar e enviar pelo WhatsApp</button>
          </aside>
        </div>
      </main>

      {pickOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-ui border border-line bg-bg p-6 shadow-ui">
            <div className="flex items-center justify-between">
              <h2 className="text-h3 font-bold">Quem é o cliente?</h2>
              <button onClick={() => setPickOpen(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-ui hover:bg-surface"><X className="size-4" /></button>
            </div>
            <p className="mt-1 text-sm text-muted">Selecione o cliente que está fazendo esta compra para enviarmos o pedido no WhatsApp dele.</p>
            <label className="relative mt-4 w-full">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input autoFocus value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder="Buscar cliente por nome ou telefone" className="min-h-[44px] w-full rounded-ui border border-line bg-bg pl-10 pr-3 text-base outline-none focus:border-ink" />
            </label>
            <div className="mt-3 flex-1 overflow-y-auto rounded-ui border border-line">
              {clientList.length === 0 && <p className="p-4 text-sm text-muted">{clients.length === 0 ? 'Você ainda não tem clientes cadastrados.' : 'Nenhum cliente encontrado.'}</p>}
              {clientList.map((c) => (
                <button key={c.id} onClick={() => setClientId(c.id)} className={`flex w-full items-center justify-between gap-3 border-b border-line p-3 text-left last:border-b-0 hover:bg-surface ${clientId === c.id ? 'bg-accent-soft' : ''}`}>
                  <span className="min-w-0"><span className="block truncate font-medium">{c.data.nome}</span><span className="block truncate text-sm text-muted">{c.data.telefone}</span></span>
                  {clientId === c.id && <CheckCircle2 className="size-5 shrink-0 text-accent" />}
                </button>
              ))}
            </div>
            {clients.length === 0 && <Link to="/fornecedor" className="mt-3 text-sm underline underline-offset-2">Cadastrar um cliente primeiro</Link>}
            {err && <p className="mt-3 text-sm text-accent">{err}</p>}
            <button disabled={!clientId || saving} onClick={confirmClientAndSend} className="btn btn-primary mt-4 w-full disabled:opacity-40"><MessageCircle className="size-4" />{saving ? 'Enviando…' : 'Enviar pedido pelo WhatsApp'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
