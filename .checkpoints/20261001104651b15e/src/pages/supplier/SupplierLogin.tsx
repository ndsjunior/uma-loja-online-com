import { Eye, EyeOff, PawPrint } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useSupplierAuth } from '../../lib/supplierAuth'
export default function SupplierLogin() {
  const { supplier, loading, login } = useSupplierAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'cadastro'>('login')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { register } = useSupplierAuth()
  if (!loading && supplier) return <Navigate to="/fornecedor" replace />
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setBusy(true)
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    try {
      if (mode === 'login') await login(d.email, d.senha)
      else await register(d.nome, d.email, d.senha)
      nav('/fornecedor')
    } catch (x) { setErr((x as Error).message || 'Não foi possível entrar. Confira os dados.') } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold text-ink"><PawPrint className="size-6 text-accent" />Petshop</Link>
        <div className="flex flex-col gap-4 rounded-ui border border-line bg-bg p-6 shadow-ui">
          <div>
            <h1 className="text-h3 font-bold">{mode === 'login' ? 'Acesso de fornecedores' : 'Criar conta de fornecedor'}</h1>
            <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Entre para gerenciar seus clientes cadastrados.' : 'Cadastre-se para começar a gerenciar seus clientes.'}</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === 'cadastro' && (
              <label className="flex flex-col gap-1"><span className="text-sm font-medium">Nome da empresa</span>
                <input required name="nome" className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink" /></label>
            )}
            <label className="flex flex-col gap-1"><span className="text-sm font-medium">E-mail</span>
              <input required name="email" type="email" className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink" /></label>
            <label className="flex flex-col gap-1"><span className="text-sm font-medium">Senha</span>
              <div className="relative">
                <input required name="senha" type={show ? 'text' : 'password'} minLength={6} className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 pr-11 text-base outline-none focus:border-ink" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-0 top-0 grid h-[44px] w-11 place-items-center text-muted" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </label>
            {err && <p className="text-sm text-accent">{err}</p>}
            <button disabled={busy} className="btn btn-primary w-full disabled:opacity-40">{busy ? 'Enviando…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          </form>
          <button onClick={() => { setMode((m) => (m === 'login' ? 'cadastro' : 'login')); setErr('') }} className="text-sm text-muted underline-offset-2 hover:underline">
            {mode === 'login' ? 'Não tem conta? Criar conta de fornecedor' : 'Já tem conta? Entrar'}
          </button>
        </div>
        <Link to="/" className="mt-6 block text-center text-sm text-muted underline-offset-2 hover:underline">Voltar para a loja</Link>
      </div>
    </div>
  )
}
