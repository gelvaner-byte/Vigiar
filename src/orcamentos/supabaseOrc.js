import { createClient } from '@supabase/supabase-js'

// Cliente próprio do app de Orçamentos. Diferente do app financeiro em dois pontos:
// 1) o login é por e-mail + senha (cada pessoa da equipe tem o seu);
// 2) a sessão fica na sessionStorage — ao fechar o navegador/app, pede login de novo.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

const memoria = {
  _d: {},
  getItem(k) { return this._d[k] ?? null },
  setItem(k, v) { this._d[k] = String(v) },
  removeItem(k) { delete this._d[k] },
}
// sessionStorage pode estar bloqueada (aba anônima, cookies desligados): cai para memória.
function armazenamento() {
  try {
    const teste = '__vg__'
    window.sessionStorage.setItem(teste, '1')
    window.sessionStorage.removeItem(teste)
    return window.sessionStorage
  } catch {
    return memoria
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: armazenamento(),
        storageKey: 'vigiar-orcamentos-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null
