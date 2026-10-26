const KEY = 'client_email'
export const getClientEmail = () => localStorage.getItem(KEY) || ''
export const setClientEmail = (email: string) => localStorage.setItem(KEY, email.trim().toLowerCase())
export const clearClientEmail = () => localStorage.removeItem(KEY)
