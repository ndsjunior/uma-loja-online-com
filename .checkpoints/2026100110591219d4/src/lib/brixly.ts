export async function api<T = any>(action: string, body: unknown = {}): Promise<T> {
  const base = import.meta.env.BASE_URL || '/'
  const tok = localStorage.getItem('app_token') || ''
  const r = await fetch(`${base}_api/${action}`.replace(/\/{2,}/g, '/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tok ? { 'X-App-Token': tok } : {}) },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Falha na integração')
  return data as T
}
