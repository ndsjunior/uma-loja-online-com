import { ArrowLeft, CheckCircle2, PawPrint } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/brixly'
import { brl } from '../lib/data'
import type { OrderRecord } from '../lib/orders'
export default function OrderView() {
  const { id } = useParams()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    try { const r = await api<OrderRecord>('db/get', { collection: 'pedidos_fornecedor', id }); setOrder(r) }
    catch (x) { setErr((x as Error).message || 'Pedido não encontrado.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  async function confirm() {
    if (!order) return
    setConfirming(true)
    try {
      await api('db/update', { collection: 'pedidos_fornecedor', id: order.id, data: { ...order.data, status: 'confirmado' } })
      await api('db/create', { collection: 'notificacoes', notify: true, data: { tipo: 'pedido_confirmado', cliente_nome: order.data.cliente_nome, total: order.data.total, pedido_id: order.id } })
      await load()
    } catch (x) { setErr((x as Error).message) } finally { setConfirming(false) }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="wrap flex h-16 items-center"><Link to="/" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop</Link></div>
      </header>
      <main className="wrap py-10">
        {loading && <p className="py-16 text-center text-muted">Carregando pedido…</p>}
        {!loading && err && <div className="grid place-items-center py-24 text-center"><p className="text-h3 font-bold">Pedido não encontrado</p><p className="mt-2 text-muted">{err}</p><Link to="/" className="btn btn-primary mt-8">Ir para a loja</Link></div>}
        {!loading && order && (
          <div className="mx-auto max-w-2xl">
            <p className="eyebrow">Pedido de {order.data.fornecedor_nome}</p>
            <h1 className="mt-1 text-h2 font-bold">Olá, {order.data.cliente_nome.split(' ')[0]}!</h1>
            <p className="mt-2 text-muted">Confira os itens que separamos para você e confirme quando estiver tudo certo.</p>

            <div className="mt-6 rounded-ui border border-line">
              <ul className="divide-y divide-line">
                {order.data.itens.map((i, idx) => (
                  <li key={idx} className="flex gap-4 p-4">
                    <img src={i.image} alt={i.name} className="size-16 shrink-0 rounded-ui object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{i.name}</p>
                      <p className="text-sm text-muted">{[i.size, i.color].filter(Boolean).join(' · ')}{i.size || i.color ? ' · ' : ''}{i.qty} unid.</p>
                    </div>
                    <span className="font-display font-bold">{brl(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-line p-4 text-lg font-bold"><span>Total</span><span className="font-display">{brl(order.data.total)}</span></div>
            </div>

            {order.data.observacoes && (
              <div className="mt-4 rounded-ui border border-line bg-surface p-4">
                <p className="text-sm font-medium">Observações</p>
                <p className="mt-1 text-sm text-muted">{order.data.observacoes}</p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              {order.data.status === 'confirmado' ? (
                <div className="flex items-center gap-3 rounded-ui border border-accent bg-accent-soft p-4 text-accent"><CheckCircle2 className="size-6 shrink-0" /><span className="font-medium">Pedido confirmado! O fornecedor já foi avisado.</span></div>
              ) : (
                <button disabled={confirming} onClick={confirm} className="btn btn-primary w-full disabled:opacity-40">{confirming ? 'Confirmando…' : 'Confirmar pedido'}</button>
              )}
              <Link to="/" className="btn btn-ghost w-full"><ArrowLeft className="size-4" />Voltar para a loja</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
