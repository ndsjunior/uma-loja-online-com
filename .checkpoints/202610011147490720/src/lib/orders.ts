export interface OrderItem { productId: string; name: string; image: string; price: number; qty: number; size?: string; color?: string }
export interface OrderData {
  fornecedor_id: string; fornecedor_nome: string
  cliente_id: string; cliente_nome: string; cliente_email: string; cliente_telefone: string
  itens: OrderItem[]; total: number; observacoes: string
  status: 'pendente' | 'confirmado'
}
export interface OrderRecord { id: string; data: OrderData; created_at: string; updated_at?: string }
export const orderTotal = (itens: OrderItem[]) => itens.reduce((a, i) => a + i.price * i.qty, 0)
function orderLink(orderId: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}pedido/${orderId}`.replace(/([^:]\/)\/+/g, '$1')
}
export function orderWaLink(telefone: string, orderId: string, fornecedorNome: string) {
  const digits = telefone.replace(/\D/g, '')
  const msg = encodeURIComponent(`Olá! Aqui é da ${fornecedorNome}. Preparei um pedido para você, dá uma olhada e confirme por aqui: ${orderLink(orderId)}`)
  return `https://wa.me/${digits}?text=${msg}`
}
export function orderWaLinkToSupplier(telefone: string, orderId: string, clienteNome: string, total: number) {
  const digits = telefone.replace(/\D/g, '')
  const msg = encodeURIComponent(`Olá! Sou ${clienteNome} e acabei de fazer um pedido na loja (total ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Confira: ${orderLink(orderId)}`)
  return `https://wa.me/${digits}?text=${msg}`
}
