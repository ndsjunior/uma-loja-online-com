import { CheckCircle2, Clock, LogOut, Pencil, PawPrint, Plus, Search, ShoppingCart, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../lib/brixly'
import { brl } from '../../lib/data'
import type { OrderRecord } from '../../lib/orders'
import { useSupplierAuth } from '../../lib/supplierAuth'
interface ClientData { nome: string; email: string; telefone: string; documento: string; endereco: string; observacoes: string; fornecedor_id: string }
interface ClientRecord { id: string; data: ClientData; created_at: string }
const emptyForm: ClientData = { nome: '', email: '', telefone: '', documento: '', endereco: '', observacoes: '', fornecedor_id: '' }
const F = ({ label, name, value, onChange, type = 'text', required = false }: { label: string; name: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) => (
  <label className="flex flex-col gap-1"><span className="text-sm font-medium">{label}</span>
    <input required={required} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink" /></label>
)
export default function SupplierDashboard() {
  const { supplier, loading, logout } = useSupplierAuth()
  const nav = useNavigate()
  const [records, setRecords] = useState<ClientRecord[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClientRecord | null>(null)
  const [form, setForm] = useState<ClientData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<ClientRecord | null>(null)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  async function loadClients() {
    setLoadingList(true)
    try {
      const r = await api<{ records: ClientRecord[] }>('db/list', { collection: 'clientes', order: 'desc', limit: 200, filter: { fornecedor_id: supplier!.id } })
      setRecords(r.records)
    } catch { /* silencioso */ } finally { setLoadingList(false) }
  }
  async function loadOrders() {
    setLoadingOrders(true)
    try {
      const r = await api<{ records: OrderRecord[] }>('db/list', { collection: 'pedidos_fornecedor', order: 'desc', limit: 30, filter: { fornecedor_id: supplier!.id } })
      setOrders(r.records)
    } catch { /* silencioso */ } finally { setLoadingOrders(false) }
  }
  useEffect(() => { if (supplier) { loadClients(); loadOrders() } }, [supplier])

  const list = useMemo(() => records.filter((r) => [r.data.nome, r.data.email, r.data.telefone].join(' ').toLowerCase().includes(q.toLowerCase())), [records, q])

  if (!loading && !supplier) return <Navigate to="/fornecedor/entrar" replace />

  function openNew() { setEditing(null); setForm({ ...emptyForm, fornecedor_id: supplier!.id }); setErr(''); setModalOpen(true) }
  function openEdit(r: ClientRecord) { setEditing(r); setForm(r.data); setErr(''); setModalOpen(true) }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      if (editing) await api('db/update', { collection: 'clientes', id: editing.id, data: form })
      else await api('db/create', { collection: 'clientes', data: form })
      setModalOpen(false); await loadClients()
    } catch (x) { setErr((x as Error).message) } finally { setSaving(false) }
  }
  async function doDelete(r: ClientRecord) {
    try { await api('db/delete', { collection: 'clientes', id: r.id }); setConfirmDelete(null); await loadClients() } catch (x) { setErr((x as Error).message) }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="wrap flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-accent" />Petshop <span className="ml-1 text-sm font-normal text-muted">· Fornecedor</span></Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{supplier?.name}</span>
            <button onClick={() => { logout(); nav('/fornecedor/entrar') }} className="btn btn-ghost min-h-[44px]"><LogOut className="size-4" />Sair</button>
          </div>
        </div>
      </header>
      <main className="wrap py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Painel do fornecedor</p>
            <h1 className="mt-1 text-h2 font-bold">Pedidos e clientes</h1>
          </div>
          <Link to="/fornecedor/novo-pedido" className="btn btn-primary min-h-[44px]"><ShoppingCart className="size-4" />Novo pedido</Link>
        </div>

        <section className="mt-8">
          <h2 className="text-h3 font-bold">Pedidos recentes</h2>
          {loadingOrders && <p className="mt-4 text-sm text-muted">Carregando pedidos…</p>}
          {!loadingOrders && orders.length === 0 && (
            <div className="mt-4 rounded-ui border border-dashed border-line p-6 text-center">
              <p className="text-sm text-muted">Nenhum pedido criado ainda. Use o botão "Novo pedido" para montar o primeiro.</p>
            </div>
          )}
          {!loadingOrders && orders.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {orders.map((o) => (
                <Link key={o.id} to={`/pedido/${o.id}`} target="_blank" className="flex flex-col gap-3 rounded-ui border border-line p-4 hover:border-ink sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{o.data.cliente_nome}</p>
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
          )}
        </section>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-h3 font-bold">Clientes cadastrados</h2>
          <button onClick={openNew} className="btn btn-primary min-h-[44px]"><Plus className="size-4" />Novo cliente</button>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone" className="min-h-[44px] w-full rounded-ui border border-line bg-bg pl-10 pr-3 text-base outline-none focus:border-ink" />
          </label>
          <span className="flex items-center gap-2 text-sm text-muted"><Users className="size-4" />{records.length} cliente{records.length === 1 ? '' : 's'}</span>
        </div>

        {loadingList && <p className="py-16 text-center text-muted">Carregando clientes…</p>}

        {!loadingList && list.length === 0 && (
          <div className="mt-8 grid place-items-center rounded-ui border border-dashed border-line py-16 text-center">
            <Users className="size-8 text-muted" />
            <p className="mt-3 font-medium">{records.length === 0 ? 'Nenhum cliente cadastrado ainda' : 'Nenhum cliente encontrado'}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">{records.length === 0 ? 'Cadastre o primeiro cliente para começar a acompanhar seus pedidos e contatos.' : 'Tente buscar por outro nome, e-mail ou telefone.'}</p>
            {records.length === 0 && <button onClick={openNew} className="btn btn-primary mt-6"><Plus className="size-4" />Cadastrar cliente</button>}
          </div>
        )}

        {!loadingList && list.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-ui border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Cadastrado em</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-surface">
                    <td className="px-4 py-3 font-medium">{r.data.nome}</td>
                    <td className="px-4 py-3 text-muted"><span className="block">{r.data.email}</span><span className="block">{r.data.telefone}</span></td>
                    <td className="px-4 py-3 text-muted">{r.data.documento || '—'}</td>
                    <td className="px-4 py-3 text-muted">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(r)} aria-label="Editar" className="grid size-9 place-items-center rounded-ui border border-line hover:border-ink"><Pencil className="size-4" /></button>
                        <button onClick={() => setConfirmDelete(r)} aria-label="Excluir" className="grid size-9 place-items-center rounded-ui border border-line text-accent hover:border-accent"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-lg rounded-ui border border-line bg-bg p-6 shadow-ui">
            <div className="flex items-center justify-between">
              <h2 className="text-h3 font-bold">{editing ? 'Editar cliente' : 'Novo cliente'}</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-ui hover:bg-surface"><X className="size-4" /></button>
            </div>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
              <F label="Nome completo" name="nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="E-mail" name="email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
                <F label="Telefone" name="telefone" type="tel" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="CPF/CNPJ" name="documento" value={form.documento} onChange={(v) => setForm({ ...form, documento: v })} />
                <F label="Endereço" name="endereco" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} />
              </div>
              <label className="flex flex-col gap-1"><span className="text-sm font-medium">Observações</span>
                <textarea name="observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} className="w-full rounded-ui border border-line bg-bg px-3 py-2 text-base outline-none focus:border-ink" /></label>
              {err && <p className="text-sm text-accent">{err}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost flex-1">Cancelar</button>
                <button disabled={saving} className="btn btn-primary flex-1 disabled:opacity-40">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-ui border border-line bg-bg p-6 shadow-ui">
            <h2 className="text-h3 font-bold">Excluir cliente?</h2>
            <p className="mt-2 text-sm text-muted">Tem certeza que deseja excluir <strong>{confirmDelete.data.nome}</strong>? Essa ação não pode ser desfeita.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost flex-1">Cancelar</button>
              <button onClick={() => doDelete(confirmDelete)} className="btn btn-primary flex-1">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
