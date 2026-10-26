import { api } from './brixly'
export interface SupplierProfileData { fornecedor_id: string; whatsapp: string }
export interface SupplierProfileRecord { id: string; data: SupplierProfileData }
export async function getSupplierProfile(fornecedorId: string): Promise<SupplierProfileRecord | null> {
  const r = await api<{ records: SupplierProfileRecord[] }>('db/list', { collection: 'perfis_fornecedor', limit: 1, filter: { fornecedor_id: fornecedorId } })
  return r.records[0] || null
}
export async function saveSupplierWhatsapp(fornecedorId: string, whatsapp: string): Promise<void> {
  const existing = await getSupplierProfile(fornecedorId)
  if (existing) await api('db/update', { collection: 'perfis_fornecedor', id: existing.id, data: { fornecedor_id: fornecedorId, whatsapp } })
  else await api('db/create', { collection: 'perfis_fornecedor', data: { fornecedor_id: fornecedorId, whatsapp } })
}
