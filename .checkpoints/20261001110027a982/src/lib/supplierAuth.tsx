import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './brixly'
export interface Supplier { id: string; name: string; email: string }
interface Ctx { supplier: Supplier | null; loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void }
const C = createContext<Ctx | null>(null)
const TOKEN_KEY = 'app_token'
export function SupplierAuthProvider({ children }: { children: ReactNode }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const tok = localStorage.getItem(TOKEN_KEY)
    if (!tok) { setLoading(false); return }
    api<{ user: Supplier }>('auth/me').then((r) => setSupplier(r.user)).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setLoading(false))
  }, [])
  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: Supplier }>('auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, r.token); setSupplier(r.user)
  }
  const register = async (name: string, email: string, password: string) => {
    const r = await api<{ token: string; user: Supplier }>('auth/register', { name, email, password })
    localStorage.setItem(TOKEN_KEY, r.token); setSupplier(r.user)
  }
  const logout = () => { localStorage.removeItem(TOKEN_KEY); setSupplier(null) }
  return <C.Provider value={{ supplier, loading, login, register, logout }}>{children}</C.Provider>
}
export const useSupplierAuth = () => useContext(C)!
