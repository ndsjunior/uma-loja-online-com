export type Category = 'Cachorro' | 'Gato' | 'Acessórios' | 'Brinquedos'
export interface Product {
  id: string; name: string; category: Category; price: number; oldPrice?: number
  images: string[]; sizes?: string[]; colors?: { name: string; swatch: string }[]; description: string
}
const u = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`
const A = u('1450778869180-41d0601e046e'), B = u('1548199973-03cce0bbc87b'), C = u('1583337130417-3346a1be7dee')
export const categories: Category[] = ['Cachorro', 'Gato', 'Acessórios', 'Brinquedos']
export const products: Product[] = [
  { id: 'racao-adulto', name: 'Ração Premium Cães Adultos', category: 'Cachorro', price: 189.9, oldPrice: 219.9, images: [A, B, C], sizes: ['3 kg', '10 kg', '15 kg'], description: 'Ração completa para cães adultos de todos os portes, com proteína de frango e arroz.' },
  { id: 'petisco-dental', name: 'Petisco Dental para Cães', category: 'Cachorro', price: 34.9, images: [B, C], sizes: ['P', 'M', 'G'], description: 'Bastões mastigáveis que ajudam na limpeza dos dentes no dia a dia.' },
  { id: 'racao-gato', name: 'Ração Gatos Castrados', category: 'Gato', price: 129.9, images: [C, A], sizes: ['1 kg', '3 kg', '10 kg'], description: 'Fórmula com controle de calorias para gatos castrados.' },
  { id: 'areia', name: 'Areia Higiênica Granulada', category: 'Gato', price: 42.9, oldPrice: 49.9, images: [A, C], sizes: ['4 kg', '12 kg'], description: 'Alta absorção e controle de odor por mais tempo.' },
  { id: 'coleira', name: 'Coleira Ajustável Nylon', category: 'Acessórios', price: 39.9, images: [B, A], sizes: ['P', 'M', 'G'], colors: [{ name: 'Vermelho', swatch: 'bg-accent' }, { name: 'Preto', swatch: 'bg-ink' }, { name: 'Cinza', swatch: 'bg-muted' }], description: 'Nylon resistente com fivela de engate rápido e argola para guia.' },
  { id: 'cama', name: 'Cama Redonda Pelúcia', category: 'Acessórios', price: 159.9, images: [C, B], sizes: ['P', 'M', 'G'], colors: [{ name: 'Cinza', swatch: 'bg-muted' }, { name: 'Preto', swatch: 'bg-ink' }], description: 'Borda elevada e enchimento macio para o pet se aninhar.' },
  { id: 'bolinha', name: 'Bolinha Mordedor Resistente', category: 'Brinquedos', price: 24.9, images: [A, B], colors: [{ name: 'Vermelho', swatch: 'bg-accent' }, { name: 'Preto', swatch: 'bg-ink' }], description: 'Borracha atóxica que aguenta mordidas fortes.' },
  { id: 'arranhador', name: 'Arranhador Torre para Gatos', category: 'Brinquedos', price: 249.9, oldPrice: 289.9, images: [C, A, B], description: 'Três andares com sisal, toca e bolinha pendurada.' },
]
export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
