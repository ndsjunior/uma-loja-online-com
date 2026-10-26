import { PawPrint } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { setClientEmail } from '../../lib/clientSession'
export default function ClientLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    setClientEmail(email)
    nav('/meus-pedidos')
  }
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold text-ink"><PawPrint className="size-6 text-accent" />Petshop</Link>
        <div className="flex flex-col gap-4 rounded-ui border border-line bg-bg p-6 shadow-ui">
          <div>
            <h1 className="text-h3 font-bold">Meus pedidos</h1>
            <p className="mt-1 text-sm text-muted">Digite o e-mail que o fornecedor usou no seu cadastro para ver seus pedidos.</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1"><span className="text-sm font-medium">E-mail</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[44px] w-full rounded-ui border border-line bg-bg px-3 text-base outline-none focus:border-ink" /></label>
            <button className="btn btn-primary w-full">Ver meus pedidos</button>
          </form>
        </div>
        <Link to="/" className="mt-6 block text-center text-sm text-muted underline-offset-2 hover:underline">Voltar para a loja</Link>
      </div>
    </div>
  )
}
