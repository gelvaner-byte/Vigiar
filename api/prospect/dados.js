// Lê a base de prospecção para o painel e para o TRON. Só leitura.
import { lerColecao, lerConfig } from './_lib.js'
import { usuarioDoToken } from '../ml/_lib.js'

const jwtDa = (req) => {
  const a = req.headers.authorization || ''
  return a.startsWith('Bearer ') ? a.slice(7) : ''
}

export default async function handler(req, res) {
  const jwt = jwtDa(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })

  try {
    const cabecalhos = { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` }
    const [leads, relatorios, cfg] = await Promise.all([
      lerColecao('prospect_leads', cabecalhos),
      lerColecao('prospect_relatorios', cabecalhos, { limite: 120 }),
      lerConfig(cabecalhos),
    ])
    relatorios.sort((a, b) => String(b.data).localeCompare(String(a.data)))
    leads.sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0))
    return res.status(200).json({
      configurado: !!process.env.ANTHROPIC_API_KEY,
      rotinaPronta: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      cfg, leads, relatorios, lidoEm: new Date().toISOString(),
    })
  } catch (e) {
    console.error('prospect/dados', e)
    return res.status(502).json({ erro: String(e.message || e) })
  }
}
