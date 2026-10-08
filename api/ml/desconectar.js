// Desliga a conta: apaga os tokens guardados. Não mexe em nada no Mercado Livre.
import { gravarConexao, jwtDaRequisicao, usuarioDoToken } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
  const jwt = jwtDaRequisicao(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })

  await gravarConexao(jwt, dono.id, { desconectadoEm: new Date().toISOString(), desconectadoPor: dono.email })
  return res.status(200).json({ ok: true })
}
