import { PawPrint } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/brixly'
import { setClientEmail } from '../../lib/clientSession'
interface ClientData { nome: string; email: string; telefone: string; documento: string; endereco: string; observacoes: string; fornecedor_id: string }
interface ClientRecord { id: string; data: ClientData; created_at: string }
export default function ClientLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const normalized = email.trim().toLowerCase()
      const r = await api<{ records: ClientRecord[] }>('db/list', { collection: 'clientes', limit: 50, filter: { email: normalized } })
      if (r.records.length === 0) {
        setErr('Não encontramos um cadastro de cliente com esse e-mail. Fale com seu fornecedor para ser cadastrado.')
        return
      }
      setClientEmail(normalized)
      nav('/pedidos/novo')
    } catch (x) { setErr((x as Error).message || 'Não foi possível verificar seu cadastro.') } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold text-ink"><PawPrint className="size-6 text-accent" />Petshop</Link>
        <div className="flex flex-col gap-4 rounded-ui border border-line bg-bg p-6 shadow-ui">
          <div>
            <h1 className="text-h3 font-bold">Área do cliente</h1>
            <p className="mt-1 text-sm text-muted">Digite o e-mail que o fornecedor usou no seu cadastro para fazer um pedido ou ver os anteriores.</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1"><span className="text-sm font-medium">E-mail</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink" /></label>
            {err && <p className="text-sm text-accent">{err}</p>}
            <button disabled={busy} className="btn btn-primary w-full disabled:opacity-40">{busy ? 'Verificando…' : 'Entrar'}</button>
          </form>
        </div>
        <Link to="/" className="mt-6 block text-center text-sm text-muted underline-offset-2 hover:underline">Voltar para a loja</Link>
      </div>
    </div>
  )
}
