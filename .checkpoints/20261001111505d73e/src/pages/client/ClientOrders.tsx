import { CheckCircle2, Clock, LogOut, PawPrint, PackageSearch, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../lib/brixly'
import { clearClientEmail, getClientEmail } from '../../lib/clientSession'
import { brl } from '../../lib/data'
import type { OrderRecord } from '../../lib/orders'
export default function ClientOrders() {
  const nav = useNavigate()
  const email = getClientEmail()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) return
    api<{ records: OrderRecord[] }>('db/list', { collection: 'pedidos_fornecedor', order: 'desc', limit: 100, filter: { cliente_email: email } })
      .then((r) => setOrders(r.records)).catch(() => {}).finally(() => setLoading(false))
  }, [email])

  if (!email) return <Navigate to="/meus-pedidos/entrar" replace />

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="wrap flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop</Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{email}</span>
            <button onClick={() => { clearClientEmail(); nav('/') }} className="btn btn-ghost min-h-[44px]"><LogOut className="size-4" />Sair</button>
          </div>
        </div>
      </header>
      <main className="wrap py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Sua conta</p>
            <h1 className="mt-1 text-h2 font-bold">Meus pedidos</h1>
          </div>
          <Link to="/pedidos/novo" className="btn btn-primary min-h-[44px]"><Plus className="size-4" />Novo pedido</Link>
        </div>

        {loading && <p className="py-16 text-center text-muted">Carregando pedidos…</p>}

        {!loading && orders.length === 0 && (
          <div className="mt-8 grid place-items-center rounded-ui border border-dashed border-line py-16 text-center">
            <PackageSearch className="size-8 text-muted" />
            <p className="mt-3 font-medium">Nenhum pedido encontrado para este e-mail</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Quando um fornecedor criar um pedido para você, ele aparece aqui.</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {orders.map((o) => (
            <Link key={o.id} to={`/pedido/${o.id}`} className="flex flex-col gap-3 rounded-ui border border-line p-4 hover:border-ink sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{o.data.fornecedor_nome}</p>
                <p className="text-sm text-muted">{o.data.itens.length} item{o.data.itens.length === 1 ? '' : 's'} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-display text-lg font-bold">{brl(o.data.total)}</span>
                {o.data.status === 'confirmado'
                  ? <span className="flex items-center gap-1 rounded-ui bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"><CheckCircle2 className="size-4" />Confirmado</span>
                  : <span className="flex items-center gap-1 rounded-ui bg-sun px-3 py-1.5 text-sm font-medium text-sun-ink"><Clock className="size-4" />Aguardando</span>}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
