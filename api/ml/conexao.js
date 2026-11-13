// Liga e desliga a conta do Mercado Livre.
// Sem ?acao=sair é o passo 1 do OAuth (vai para a tela de autorização); com acao=sair,
// apaga os tokens. As duas coisas juntas aqui porque o plano tem teto de funções.
import { ML_AUTH, criarEstado, gravarConexao, jwtDaRequisicao, usuarioDoToken } from './_lib.js'

export default async function handler(req, res) {
  if (req.query.acao === 'sair') {
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
    const jwt = jwtDaRequisicao(req)
    const dono = jwt ? await usuarioDoToken(jwt) : null
    if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })
    await gravarConexao(jwt, dono.id, { desconectadoEm: new Date().toISOString(), desconectadoPor: dono.email })
    return res.status(200).json({ ok: true })
  }

  const { ML_CLIENT_ID, ML_REDIRECT_URI } = process.env
  if (!ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
    return res.status(503).json({
      erro: 'Integração não configurada: faltam ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI na Vercel.',
    })
  }

  const jwt = String(req.query.token || '')
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).send('Entre no app com a conta do dono antes de conectar o Mercado Livre.')

  const state = criarEstado({ jwt, userId: dono.id, email: dono.email })
  const url = `${ML_AUTH}?${new URLSearchParams({
    response_type: 'code', client_id: ML_CLIENT_ID, redirect_uri: ML_REDIRECT_URI, state,
  })}`
  res.writeHead(302, { Location: url })
  res.end()
}
