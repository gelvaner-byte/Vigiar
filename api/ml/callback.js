// Passo 2 do OAuth: o Mercado Livre devolve o código aqui. Trocamos por token e guardamos cifrado.
import { cifrar, gravarConexao, lerEstado, ml, trocarCodigoPorToken } from './_lib.js'

const pagina = (titulo, texto, cor = '#22d39a') => `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070c14;color:#e8f0fb;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px}
.c{max-width:420px;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(120,180,255,.2);
border-radius:18px;padding:30px 24px}h1{font-size:18px;margin:0 0 10px;color:${cor}}
p{font-size:14px;line-height:1.6;color:#b9cbe4;margin:0 0 18px}
a{display:inline-block;background:#e2640a;color:#fff;text-decoration:none;border-radius:11px;padding:12px 18px;font-weight:700}
</style></head><body><div class="c"><h1>${titulo}</h1><p>${texto}</p>
<a href="/orcamentos">Voltar para o app</a></div></body></html>`

export default async function handler(req, res) {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  const { code, state, error, error_description: desc } = req.query || {}

  if (error) return res.status(400).send(pagina('Autorização negada', desc || String(error), '#ff6b6b'))
  if (!code || !state) return res.status(400).send(pagina('Faltou informação', 'O Mercado Livre não devolveu o código de autorização.', '#ff6b6b'))

  try {
    const { jwt, userId, email } = lerEstado(String(state))
    const token = await trocarCodigoPorToken(String(code), process.env.ML_REDIRECT_URI)
    const eu = await ml('/users/me', token.access_token)

    await gravarConexao(jwt, userId, {
      conectadoEm: new Date().toISOString(),
      conectadoPor: email,
      mlUserId: eu.id,
      apelido: eu.nickname,
      siteId: eu.site_id,
      access: cifrar(token.access_token),
      refresh: cifrar(token.refresh_token),
      expiraEm: Date.now() + (token.expires_in || 21600) * 1000,
    })

    return res.status(200).send(pagina(
      'Mercado Livre conectado',
      `Conta <b>${eu.nickname}</b> ligada ao sistema. Pode voltar ao app: o TRON já enxerga seus anúncios e vendas.`,
    ))
  } catch (e) {
    console.error('ml/callback', e)
    return res.status(500).send(pagina('Não deu para conectar', String(e.message || e), '#ff6b6b'))
  }
}
