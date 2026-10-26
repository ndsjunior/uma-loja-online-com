import { MessageCircle, ShoppingBag } from 'lucide-react'
import { Chapter, HCard, HorizontalScroll, Magnetic, MarqueeParallax, Reveal, RevealGroup, RevealItem, SplitWords, StickyScrollytelling, TextMaskReveal, ZoomThrough } from './fx/cinema'
import Catalog from './Catalog'
import { categories } from '../lib/data'

const colecoes = [
  { t: 'Cachorro', x: 'Ração, petiscos e cuidados para cães de todos os portes.', img: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1600&q=80' },
  { t: 'Gato', x: 'Rações, areia higiênica e o que o felino exige.', img: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1600&q=80' },
  { t: 'Acessórios', x: 'Coleiras, camas e itens para o dia a dia do pet.', img: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1600&q=80' },
  { t: 'Brinquedos', x: 'Mordedores e arranhadores para gastar energia.' },
]

export default function Home({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <>
      <Chapter state="esfera" side="right">
        <div className="wrap grid lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <p className="eyebrow">Pet shop online</p>
            <SplitWords text="Tudo que seu pet precisa" className="text-mega" />
            <Reveal delay={0.5}><p className="max-w-xl text-lead text-muted">Ração, petiscos, acessórios e brinquedos para cães e gatos, entregue em casa.</p></Reveal>
            <Reveal delay={0.7} className="flex flex-wrap gap-3">
              <Magnetic><a href="#vitrine" className="btn btn-primary"><ShoppingBag className="size-5" />Ver produtos</a></Magnetic>
              <a href="https://wa.me/55[seu WhatsApp]" className="btn btn-ghost"><MessageCircle className="size-5" />Fale no WhatsApp</a>
            </Reveal>
          </div>
        </div>
      </Chapter>
      <Chapter state="galaxia" side="center">
        <div className="wrap text-center">
          <TextMaskReveal text="Comida boa, cama macia e brinquedo novo: cuidar do seu pet ficou mais fácil com tudo num lugar só." highlight={['pet', 'fácil']} className="mx-auto max-w-5xl text-h1 md:text-display" />
        </div>
      </Chapter>
      <StickyScrollytelling side="left" steps={[
        { state: 'anel', eyebrow: '01 · Escolha', title: 'Filtre por categoria', text: 'Cachorro, gato, acessórios ou brinquedos: encontre em segundos.' },
        { state: 'helice', eyebrow: '02 · Personalize', title: 'Tamanho e cor certos', text: 'Escolha a variação que combina com o seu pet.' },
        { state: 'texto', eyebrow: '03 · Receba', title: 'Pedido direto em casa', text: 'Frete grátis em compras acima de R$ 199,00.' },
      ]} />
      <HorizontalScroll eyebrow="Categorias" title="Um mundo para cada pet" state="fundo">
        {colecoes.map((c, i) => <HCard key={c.t} index={i + 1} eyebrow="Coleção" title={c.t} text={c.x} image={c.img} alt={c.t} />)}
      </HorizontalScroll>
      <MarqueeParallax items={categories} />
      <Chapter state="nuvem" side="left" className="panel-glass">
        <div className="wrap grid lg:grid-cols-12">
          <RevealGroup className="flex flex-col gap-6 lg:col-span-6 lg:col-start-7">
            <RevealItem><p className="eyebrow">Por que comprar aqui</p></RevealItem>
            <RevealItem><h2 className="text-h1 font-bold">Compra simples, do carrinho ao checkout</h2></RevealItem>
            <RevealItem><p className="text-lead text-muted">Ajuste quantidades no carrinho lateral e veja o resumo antes de confirmar. Você recebe a confirmação do pedido na hora.</p></RevealItem>
          </RevealGroup>
        </div>
      </Chapter>
      <Catalog onOpen={onOpen} />
      <ZoomThrough word="PET" state="final">
        <div className="wrap flex flex-col items-center gap-6 text-center">
          <h2 className="text-h1 font-bold">Seu pet está esperando</h2>
          <p className="text-lead text-muted">Atendimento: [seu WhatsApp] · [seu endereço]</p>
          <Magnetic><a href="https://wa.me/55[seu WhatsApp]" className="btn btn-primary"><MessageCircle className="size-5" />Peça pelo WhatsApp</a></Magnetic>
        </div>
      </ZoomThrough>
    </>
  )
}
