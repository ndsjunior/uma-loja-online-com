import { PawPrint, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import CartDrawer from './components/CartDrawer'
import Catalog from './components/Catalog'
import Checkout from './components/Checkout'
import ProductPage from './components/ProductPage'
import { CartProvider, useCart } from './lib/cart'
import { SupplierAuthProvider } from './lib/supplierAuth'
import SupplierDashboard from './pages/supplier/SupplierDashboard'
import SupplierLogin from './pages/supplier/SupplierLogin'
type View = { name: 'home' } | { name: 'product'; id: string } | { name: 'checkout' }
function Shell() {
  const [view, setView] = useState<View>({ name: 'home' })
  const { count, setOpen } = useCart()
  const go = (v: View) => { setView(v); window.scrollTo(0, 0) }
  return (
    <>
      <div className="bg-sun py-2 text-center text-sm font-medium text-sun-ink">Frete grátis em compras acima de R$ 199,00</div>
      <header className="sticky top-0 z-40 bg-accent text-accent-ink">
        <div className="wrap flex h-16 items-center justify-between">
          <button onClick={() => go({ name: 'home' })} className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-sun" />Petshop</button>
          <button onClick={() => setOpen(true)} className="relative grid size-11 place-items-center rounded-ui hover:bg-ink" aria-label="Abrir carrinho">
            <ShoppingBag className="size-6" />
            {count > 0 && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-sun text-xs font-bold text-sun-ink">{count}</span>}
          </button>
        </div>
      </header>
      <main className="min-h-[70vh]">
        {view.name === 'home' && <Catalog onOpen={(id) => go({ name: 'product', id })} />}
        {view.name === 'product' && <ProductPage key={view.id} id={view.id} onBack={() => go({ name: 'home' })} />}
        {view.name === 'checkout' && <Checkout onBack={() => go({ name: 'home' })} />}
      </main>
      <footer className="border-t border-line bg-surface"><div className="wrap flex flex-col gap-2 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between"><span>Petshop · [seu endereço]</span><span>Atendimento: [seu WhatsApp]</span><Link to="/fornecedor/entrar" className="underline-offset-2 hover:underline">Acesso para fornecedores</Link></div></footer>
      <CartDrawer onCheckout={() => go({ name: 'checkout' })} />
    </>
  )
}
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SupplierAuthProvider>
        <Routes>
          <Route path="/fornecedor/entrar" element={<SupplierLogin />} />
          <Route path="/fornecedor" element={<SupplierDashboard />} />
          <Route path="/*" element={<CartProvider><Shell /></CartProvider>} />
        </Routes>
      </SupplierAuthProvider>
    </BrowserRouter>
  )
}
