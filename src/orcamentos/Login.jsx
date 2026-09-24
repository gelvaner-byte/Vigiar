import { useState } from 'react'
import { LogIn, ShieldCheck } from 'lucide-react'
import { supabase } from './supabaseOrc'

// Login com e-mail + senha: escritório e cada técnico têm o seu.
export default function LoginOrcamentos() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setEntrando(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })
    setEntrando(false)
    if (error) setErro('E-mail ou senha incorretos.')
  }

  return (
    <div className="vgl-fundo">
      <form className="vgl-caixa" onSubmit={entrar}>
        <div className="vgl-topo">
          <span className="vgl-logo"><ShieldCheck size={26} /></span>
          <div>
            <h1>VIGIAR</h1>
            <p>Orçamentos e ordens de serviço</p>
          </div>
        </div>

        <label className="vgl-campo">
          <span>E-mail</span>
          <input type="email" autoFocus autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" inputMode="email" />
        </label>
        <label className="vgl-campo">
          <span>Senha</span>
          <input type="password" autoComplete="current-password" required value={senha}
            onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" />
        </label>

        {erro && <p className="vgl-erro">{erro}</p>}

        <button className="vgl-btn" type="submit" disabled={entrando}>
          <LogIn size={16} /> {entrando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="vgl-nota">Por segurança, o app pede e-mail e senha toda vez que é aberto.</p>
      </form>

      <style>{`
.vgl-fundo{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:#2b1607;background-image:radial-gradient(120% 120% at 100% 0%,rgba(226,100,10,.55),transparent 60%);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.vgl-caixa{width:100%;max-width:380px;background:#fff;border-radius:20px;padding:26px 22px;box-shadow:0 18px 44px rgba(0,0,0,.35)}
.vgl-topo{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.vgl-logo{width:46px;height:46px;border-radius:13px;background:#e2640a;color:#fff;display:grid;place-items:center;flex-shrink:0}
.vgl-topo h1{margin:0;font-size:20px;letter-spacing:3px;color:#2b1607}
.vgl-topo p{margin:2px 0 0;font-size:12px;color:#64748b}
.vgl-campo{display:block;margin-bottom:14px}
.vgl-campo span{display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px}
.vgl-campo input{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:11px;padding:12px;font-size:16px;font-family:inherit;color:#2b1607;outline:none}
.vgl-campo input:focus{border-color:#e2640a;box-shadow:0 0 0 3px rgba(226,100,10,.14)}
.vgl-erro{color:#dc2626;font-size:13px;font-weight:600;text-align:center;margin:0 0 12px}
.vgl-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;
  background:#e2640a;color:#fff;font-size:15px;font-weight:700;font-family:inherit;padding:13px;cursor:pointer}
.vgl-btn:disabled{opacity:.6}
.vgl-nota{font-size:11px;color:#94a3b8;text-align:center;margin:14px 0 0;line-height:1.5}
      `}</style>
    </div>
  )
}
