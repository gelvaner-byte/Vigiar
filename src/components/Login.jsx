import { useState } from 'react'
import { LogIn } from 'lucide-react'
import Logo from './Logo'
import { supabase, APP_LOGIN_EMAIL } from '../lib/supabaseClient'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: APP_LOGIN_EMAIL, password })
    setLoading(false)
    if (error) {
      setError('Senha incorreta. Tente novamente.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-black/20"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-16 w-16" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            VIG<span className="text-orange-500">IAR</span>
          </h1>
          <p className="text-sm text-slate-500">Digite a senha de acesso para continuar</p>
        </div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-orange-500"
          required
        />

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={16} />
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
