import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from '../components/Login'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import '../index.css'

// Mesmo login (senha única) do app financeiro.
function Portao() {
  const [session, setSession] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCarregando(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return <p style={{ padding: 24, fontFamily: 'sans-serif' }}>Configuração pendente: defina as variáveis do Supabase no .env.</p>
  }
  if (carregando) return null
  if (!session) return <Login />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Portao />
  </React.StrictMode>,
)
