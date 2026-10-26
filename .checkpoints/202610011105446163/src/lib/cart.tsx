import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { products, type Product } from './data'
export interface CartItem { key: string; id: string; size?: string; color?: string; qty: number }
interface Ctx { items: CartItem[]; open: boolean; setOpen: (b: boolean) => void; add: (p: Product, size?: string, color?: string) => void
  setQty: (key: string, q: number) => void; clear: () => void; count: number; subtotal: number; find: (id: string) => Product }
const C = createContext<Ctx | null>(null)
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => JSON.parse(localStorage.getItem('cart') || '[]'))
  const [open, setOpen] = useState(false)
  useEffect(() => localStorage.setItem('cart', JSON.stringify(items)), [items])
  const find = (id: string) => products.find((p) => p.id === id)!
  const add = (p: Product, size?: string, color?: string) => {
    const key = [p.id, size, color].join('|')
    setItems((s) => s.some((i) => i.key === key) ? s.map((i) => i.key === key ? { ...i, qty: i.qty + 1 } : i) : [...s, { key, id: p.id, size, color, qty: 1 }])
    setOpen(true)
  }
  const setQty = (key: string, q: number) => setItems((s) => q <= 0 ? s.filter((i) => i.key !== key) : s.map((i) => i.key === key ? { ...i, qty: q } : i))
  const count = items.reduce((a, i) => a + i.qty, 0)
  const subtotal = items.reduce((a, i) => a + i.qty * find(i.id).price, 0)
  return <C.Provider value={{ items, open, setOpen, add, setQty, clear: () => setItems([]), count, subtotal, find }}>{children}</C.Provider>
}
export const useCart = () => useContext(C)!
