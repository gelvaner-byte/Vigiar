// Tudo do Marketing numa rota só, separada por ?acao= — o plano tem teto de funções.
//   (sem acao)  lê o painel: entregas, mídias, configuração
//   gerar       escreve o post do dia (ou um extra)
//   chat        conversa com o especialista de Instagram
//   salvar      grava entrega editada, mídia nova ou configuração
import { auth, gravar, lerColecao } from './prospect/_lib.js'
import { usuarioDoToken } from './ml/_lib.js'
import { conversar, escreverPost } from './_marketing.js'

const jwtDa = (req) => {
  const a = req.headers.authorization || ''
  return a.startsWith('Bearer ') ? a.slice(7) : ''
}
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const SB = () => process.env.VITE_SUPABASE_URL

async function lerCfg(cabecalhos) {
  const r = await fetch(`${SB()}/rest/v1/orc_registros?colecao=eq.config&id=eq.marketing&select=dados`,
    { headers: cabecalhos })
  if (!r.ok) return {}
  const linhas = await r.json()
  return linhas?.[0]?.dados || {}
}

async function gravarCfg(cabecalhos, userId, cfg) {
  const r = await fetch(`${SB()}/rest/v1/orc_registros?on_conflict=colecao,id`, {
    method: 'POST',
    headers: { ...cabecalhos, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{
      user_id: userId, colecao: 'config', id: 'marketing', dados: cfg,
      excluido: false, atualizado_em: new Date().toISOString(),
    }]),
  })
  if (!r.ok) throw new Error(await r.text())
}

// Rodízio de assunto e formato. Mesma regra do app, repetida aqui porque o cron roda
// no servidor, sem o navegador.
const ASSUNTOS = ['cftv', 'alarme', 'portao', 'acesso', 'interfone', 'cerca', 'manutencao', 'eletrica', 'iluminacao', 'drdps']
const NOMES = {
  cftv: 'Câmeras e CFTV', alarme: 'Alarmes', portao: 'Portões automáticos',
  acesso: 'Controle de acesso', interfone: 'Interfonia', cerca: 'Cerca elétrica',
  manutencao: 'Manutenção', eletrica: 'Instalações elétricas', iluminacao: 'Iluminação',
  drdps: 'DR e DPS',
}
const FORMATOS = ['dica', 'duvida', 'antesdepois', 'bastidor', 'erro', 'servico']
const NOMES_FMT = {
  dica: 'Dica', duvida: 'Dúvida frequente', antesdepois: 'Antes e depois',
  bastidor: 'Bastidores', erro: 'Erro comum', servico: 'Apresentação de serviço',
}
const PUBLICOS = ['síndico', 'morador', 'comerciante']

export function escolherPauta(entregas, hoje) {
  const dias = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000)
  const recentes = [...entregas].sort((a, b) => String(b.data).localeCompare(String(a.data)))
  const usado = new Map()
  recentes.forEach((e) => { if (e.assunto && !usado.has(e.assunto)) usado.set(e.assunto, dias(e.data, hoje)) })
  const livres = ASSUNTOS.filter((a) => (usado.get(a) ?? 99) >= 7)
  const pool = livres.length ? livres : [...ASSUNTOS].sort((a, b) => (usado.get(b) ?? 99) - (usado.get(a) ?? 99))
  const assunto = pool[0]
  const fmtRecentes = recentes.slice(0, 3).map((e) => e.formato)
  const fmtLivres = FORMATOS.filter((f) => !fmtRecentes.includes(f))
  const formato = (fmtLivres.length ? fmtLivres : FORMATOS)[0]
  return { assunto, formato, publico: PUBLICOS[recentes.length % PUBLICOS.length] }
}

// Gera a entrega do dia. Uma por dia: se já existe, não duplica — a não ser que seja extra.
export async function gerarEntrega({ cabecalhos, userId, data, extra = false, pedido = '' }) {
  const entregas = await lerColecao('marketing_entregas', cabecalhos, { limite: 200 })
  if (!extra) {
    const jaTem = entregas.find((e) => e.data === data && !e.extra && e.ok)
    if (jaTem) return { entrega: jaTem, jaExistia: true }
  }

  const midias = (await lerColecao('marketing_midias', cabecalhos, { limite: 300 }))
    .filter((m) => m.conferida && !m.arquivada)
  const prioritarias = midias.filter((m) => m.prioritaria)
  const usaveis = (prioritarias.length ? prioritarias : midias).slice(0, 8)

  const pauta = escolherPauta(entregas.filter((e) => e.ok), data)
  const base = {
    id: extra ? `post-${data}-x${Date.now().toString(36)}` : `post-${data}`,
    data, extra,
    assunto: pauta.assunto, formato: pauta.formato, publico: pauta.publico,
    assuntoNome: NOMES[pauta.assunto], formatoNome: NOMES_FMT[pauta.formato],
    geradoEm: new Date().toISOString(),
  }

  try {
    const post = await escreverPost({
      assunto: NOMES[pauta.assunto],
      formato: NOMES_FMT[pauta.formato],
      publico: pauta.publico,
      midias: usaveis.map((m) => ({ id: m.id, assunto: m.assunto, nota: m.nota, prioritaria: m.prioritaria })),
      historico: entregas.filter((e) => e.ok).slice(0, 8),
      pedido,
    })
    const entrega = { ...base, ok: true, ...post, publicadoEm: null }
    await gravar('marketing_entregas', [entrega], cabecalhos, userId)
    // Foto marcada como "usar no próximo post" já cumpriu o papel.
    const usadas = post.cards.map((c) => c.midiaId).filter(Boolean)
    if (usadas.length) {
      const baixar = midias.filter((m) => usadas.includes(m.id) && m.prioritaria)
        .map((m) => ({ ...m, prioritaria: false, usadaEm: data }))
      if (baixar.length) await gravar('marketing_midias', baixar, cabecalhos, userId)
    }
    return { entrega, jaExistia: false }
  } catch (e) {
    const falha = { ...base, ok: false, erro: String(e.message || e) }
    await gravar('marketing_entregas', [falha], cabecalhos, userId)
    return { entrega: falha, jaExistia: false, erro: falha.erro }
  }
}

export default async function handler(req, res) {
  const jwt = jwtDa(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })

  const cabecalhos = auth({ jwt })
  const acao = req.query.acao || ''

  try {
    if (!acao) {
      const [entregas, midias, cfg] = await Promise.all([
        lerColecao('marketing_entregas', cabecalhos, { limite: 200 }),
        lerColecao('marketing_midias', cabecalhos, { limite: 300 }),
        lerCfg(cabecalhos),
      ])
      entregas.sort((a, b) => String(b.data).localeCompare(String(a.data)))
      midias.sort((a, b) => String(b.enviadaEm).localeCompare(String(a.enviadaEm)))
      return res.status(200).json({
        configurado: !!process.env.ANTHROPIC_API_KEY,
        rotinaPronta: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        entregas, midias, cfg, hoje: hojeBR(),
      })
    }

    if (acao === 'gerar') {
      if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
      const r = await gerarEntrega({
        cabecalhos, userId: dono.id, data: hojeBR(),
        extra: !!req.body?.extra, pedido: String(req.body?.pedido || ''),
      })
      return res.status(r.erro ? 502 : 200).json(r)
    }

    if (acao === 'chat') {
      if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
      const r = await conversar({
        mensagens: req.body?.mensagens || [],
        retrato: req.body?.retrato || {},
      })
      return res.status(200).json(r)
    }

    if (acao === 'salvar') {
      if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
      const { entrega, midias, cfg } = req.body || {}
      if (entrega) await gravar('marketing_entregas', [entrega], cabecalhos, dono.id)
      if (Array.isArray(midias) && midias.length) await gravar('marketing_midias', midias, cabecalhos, dono.id)
      if (cfg) await gravarCfg(cabecalhos, dono.id, cfg)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ erro: `Não sei fazer "${acao}".` })
  } catch (e) {
    console.error('marketing', e)
    return res.status(502).json({ erro: String(e.message || e) })
  }
}
