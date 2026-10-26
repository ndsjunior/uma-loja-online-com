import { PawPrint, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import CartDrawer from './components/CartDrawer'
import Home from './components/Home'
import { ScrollProgress, ScrollStage, SmoothScroll } from './components/fx/cinema'
import Checkout from './components/Checkout'
import ProductPage from './components/ProductPage'
import { CartProvider, useCart } from './lib/cart'
type View = { name: 'home' } | { name: 'product'; id: string } | { name: 'checkout' }
function Shell() {
  const [view, setView] = useState<View>({ name: 'home' })
  const { count, setOpen } = useCart()
  const go = (v: View) => { setView(v); window.scrollTo(0, 0) }
  return (
    <SmoothScroll>
      {view.name === 'home' && <ScrollStage scene="particulas" word="PETSHOP" colors={['#2F7BFF', '#FFD100']} intensity={1} />}
      <ScrollProgress />
      <div className="bg-sun py-2 text-center text-sm font-medium text-sun-ink">Frete grátis em compras acima de R$ 199,00</div>
      <header className="glass sticky top-0 z-50 text-ink">
        <div className="wrap flex h-16 items-center justify-between">
          <button onClick={() => go({ name: 'home' })} className="flex items-center gap-2 font-display text-xl font-bold"><PawPrint className="size-6 text-sun" />Petshop</button>
          <button onClick={() => setOpen(true)} className="relative grid size-11 place-items-center rounded-ui hover:bg-surface" aria-label="Abrir carrinho">
            <ShoppingBag className="size-6" />
            {count > 0 && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-sun text-xs font-bold text-sun-ink">{count}</span>}
          </button>
        </div>
      </header>
      <main className="content-layer grain min-h-[70vh]">
        {view.name === 'home' && <Home onOpen={(id) => go({ name: 'product', id })} />}
        {view.name === 'product' && <ProductPage key={view.id} id={view.id} onBack={() => go({ name: 'home' })} />}
        {view.name === 'checkout' && <Checkout onBack={() => go({ name: 'home' })} />}
      </main>
      <footer className="panel-solid border-t border-line"><div className="wrap flex flex-col gap-2 py-8 text-sm text-muted md:flex-row md:justify-between"><span>Petshop · [seu endereço]</span><span>Atendimento: [seu WhatsApp]</span></div></footer>
      <CartDrawer onCheckout={() => go({ name: 'checkout' })} />
    </SmoothScroll>
  )
}
export default function App() { return <CartProvider><Shell /></CartProvider> }
