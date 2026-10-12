// Pesquisa sob demanda: o Gelvan (ou o TRON) pede uma busca agora, sem esperar as 10h.
// Usa o login de quem pediu, então não depende da chave de serviço.
import { auth, lerConfig } from './_lib.js'
import { rodarRotina } from './rotina.js'
import { usuarioDoToken } from '../ml/_lib.js'

const jwtDa = (req) => {
  const a = req.headers.authorization || ''
  return a.startsWith('Bearer ') ? a.slice(7) : ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })

  const jwt = jwtDa(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ erro: 'Falta a chave da Anthropic na Vercel.' })
  }

  const { pedido = '', segmentos = null, quantidade = null } = req.body || {}
  try {
    const cabecalhos = auth({ jwt })
    const cfg = await lerConfig(cabecalhos)
    const { relatorio, novos } = await rodarRotina({
      cabecalhos, cfg, userId: dono.id,
      pedidoLivre: String(pedido || '').trim(),
      segmentos: Array.isArray(segmentos) && segmentos.length ? segmentos : null,
      quantidadePorBusca: quantidade || null,
    })
    return res.status(200).json({ ok: true, relatorio, novos })
  } catch (e) {
    console.error('prospect/pesquisar', e)
    return res.status(502).json({ erro: String(e.message || e) })
  }
}
