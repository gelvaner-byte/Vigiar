// Base da integração com o Mercado Livre.
// Os tokens ficam no banco SEMPRE criptografados: quem abrir a tabela vê só texto embaralhado.
// A chave de criptografia e o segredo do app vivem só nas variáveis da Vercel.

import crypto from 'node:crypto'

export const ML_AUTH = 'https://auth.mercadolivre.com.br/authorization'
export const ML_API = 'https://api.mercadolibre.com'
export const COLECAO = 'config'
export const DOC = 'mercadolivre'

const segredoCripto = () => process.env.ML_CRIPTO_SEGREDO || process.env.ML_CLIENT_SECRET || ''

function chave() {
  const s = segredoCripto()
  if (!s) throw new Error('Falta ML_CRIPTO_SEGREDO na Vercel.')
  return crypto.createHash('sha256').update(s).digest()
}

export function cifrar(texto) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv)
  const dados = Buffer.concat([c.update(String(texto), 'utf8'), c.final()])
  return `${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${dados.toString('base64url')}`
}

export function decifrar(pacote) {
  const [iv, tag, dados] = String(pacote).split('.')
  const d = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(dados, 'base64url')), d.final()]).toString('utf8')
}

// O "state" do OAuth leva, cifrado, o login de quem pediu a conexão.
export const criarEstado = (payload) => cifrar(JSON.stringify({ ...payload, em: Date.now() }))
export function lerEstado(state) {
  const dados = JSON.parse(decifrar(state))
  if (Date.now() - dados.em > 15 * 60 * 1000) throw new Error('Autorização expirou. Tente conectar de novo.')
  return dados
}

/* ===== Supabase: guardamos o registro da conexão na mesma tabela do app ===== */

const sbUrl = () => process.env.VITE_SUPABASE_URL
const sbKey = () => process.env.VITE_SUPABASE_ANON_KEY

export async function usuarioDoToken(jwt) {
  const r = await fetch(`${sbUrl()}/auth/v1/user`, { headers: { apikey: sbKey(), Authorization: `Bearer ${jwt}` } })
  if (!r.ok) return null
  const u = await r.json()
  const email = String(u?.email || '').toLowerCase()
  const donos = String(process.env.TRON_DONOS || 'acesso@vigiar.app')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return donos.includes(email) ? { id: u.id, email } : null
}

export async function lerConexao(jwt) {
  const r = await fetch(
    `${sbUrl()}/rest/v1/orc_registros?colecao=eq.${COLECAO}&id=eq.${DOC}&select=dados`,
    { headers: { apikey: sbKey(), Authorization: `Bearer ${jwt}` } },
  )
  if (!r.ok) return null
  const linhas = await r.json()
  return linhas?.[0]?.dados || null
}

export async function gravarConexao(jwt, userId, dados) {
  const r = await fetch(`${sbUrl()}/rest/v1/orc_registros?on_conflict=colecao,id`, {
    method: 'POST',
    headers: {
      apikey: sbKey(),
      Authorization: `Bearer ${jwt}`,
      'content-type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{
      user_id: userId, colecao: COLECAO, id: DOC, dados, excluido: false,
      atualizado_em: new Date().toISOString(),
    }]),
  })
  if (!r.ok) throw new Error('Não consegui guardar a conexão: ' + (await r.text()))
}

/* ===== Tokens do Mercado Livre ===== */

export async function trocarCodigoPorToken(code, redirectUri) {
  const r = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })
  const dados = await r.json()
  if (!r.ok) throw new Error(dados?.message || dados?.error || 'Falha ao trocar o código por token.')
  return dados
}

export async function renovarToken(refreshToken) {
  const r = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })
  const dados = await r.json()
  if (!r.ok) throw new Error(dados?.message || dados?.error || 'Falha ao renovar o token.')
  return dados
}

// Devolve um access token válido, renovando sozinho quando faltar menos de 5 minutos.
export async function tokenValido(jwt, userId) {
  const conexao = await lerConexao(jwt)
  if (!conexao?.access) return null
  const faltam = (conexao.expiraEm || 0) - Date.now()
  if (faltam > 5 * 60 * 1000) return { token: decifrar(conexao.access), conexao }

  if (!conexao.refresh) return null
  const novo = await renovarToken(decifrar(conexao.refresh))
  const atualizado = {
    ...conexao,
    access: cifrar(novo.access_token),
    refresh: cifrar(novo.refresh_token || decifrar(conexao.refresh)),
    expiraEm: Date.now() + (novo.expires_in || 21600) * 1000,
    renovadoEm: new Date().toISOString(),
  }
  await gravarConexao(jwt, userId, atualizado)
  return { token: novo.access_token, conexao: atualizado }
}

// Chamada à API do Mercado Livre já com o token.
export async function ml(caminho, token, opcoes = {}) {
  const r = await fetch(`${ML_API}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json', ...(opcoes.headers || {}) },
  })
  if (r.status === 429) throw new Error('O Mercado Livre pediu para esperar (limite de chamadas). Tente de novo em instantes.')
  const dados = await r.json().catch(() => null)
  if (!r.ok) throw new Error(dados?.message || `Mercado Livre respondeu ${r.status} em ${caminho}`)
  return dados
}

export const jwtDaRequisicao = (req) => {
  const auth = req.headers.authorization || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}
