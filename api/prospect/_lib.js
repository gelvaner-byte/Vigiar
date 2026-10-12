// TRON PROSPECT — base do agente de prospecção.
// Guarda tudo na mesma tabela do app (orc_registros), em coleções próprias:
//   prospect_leads      → uma ficha por cliente encontrado
//   prospect_relatorios → um relatório por dia
//   config/prospect     → cidades, meta diária e pesos da pontuação
// Nada aqui entra em contato com ninguém: só pesquisa, qualifica e escreve a ficha.

const SB_URL = () => process.env.VITE_SUPABASE_URL
const SB_ANON = () => process.env.VITE_SUPABASE_ANON_KEY
const SB_SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY

export const MODELO = process.env.PROSPECT_MODELO || 'claude-sonnet-5-5'
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || ''

/* ===== configuração ===== */

export const CONFIG_PADRAO = {
  cidades: ['Belo Horizonte - MG', 'Lagoa Santa - MG', 'Nova Lima - MG'],
  metaDiaria: 10,
  // Cada peso é o máximo de pontos que o critério vale. Somados dão 100.
  pesos: {
    compatibilidade: 25,   // o que a Vigiar faz bate com o que o cliente precisa
    recorrencia: 20,       // chance de virar contrato mensal de manutenção
    contato: 15,           // existe canal comercial público e utilizável
    evidencia: 15,         // há sinal verificável de necessidade
    porte: 10,             // tamanho e capacidade de pagar
    localizacao: 8,        // deslocamento viável a partir de BH
    abordagem: 7,          // facilidade de chegar em quem decide
  },
  // Quantos segmentos entram em cada rodada. Administradora e condomínio primeiro.
  segmentosPrioritarios: ['administradora', 'condominio'],
}

export const FAIXAS = [
  { min: 80, nome: 'alta', rotulo: 'Prioridade alta' },
  { min: 60, nome: 'media', rotulo: 'Prioridade média' },
  { min: 40, nome: 'acompanhar', rotulo: 'Acompanhamento' },
  { min: 0, nome: 'baixa', rotulo: 'Baixa prioridade' },
]
export const faixaDe = (p) => FAIXAS.find((f) => p >= f.min) || FAIXAS[FAIXAS.length - 1]

export const ESTAGIOS = [
  'identificado', 'pesquisa_concluida', 'qualificado', 'aguardando_contato',
  'contato_realizado', 'aguardando_resposta', 'interessado', 'visita_agendada',
  'orcamento_em_elaboracao', 'proposta_enviada', 'negociacao', 'contrato_fechado', 'perdido',
]
export const ROTULO_ESTAGIO = {
  identificado: 'Cliente identificado',
  pesquisa_concluida: 'Pesquisa concluída',
  qualificado: 'Cliente qualificado',
  aguardando_contato: 'Aguardando contato',
  contato_realizado: 'Contato realizado',
  aguardando_resposta: 'Aguardando resposta',
  interessado: 'Cliente interessado',
  visita_agendada: 'Visita técnica agendada',
  orcamento_em_elaboracao: 'Orçamento em elaboração',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  contrato_fechado: 'Contrato fechado',
  perdido: 'Oportunidade perdida',
}

/* ===== Supabase ===== */

// O cron roda sem usuário logado, então usa a chave de serviço.
// As chamadas vindas do app usam o próprio login de quem está na tela.
export function auth({ jwt } = {}) {
  if (jwt) return { apikey: SB_ANON(), Authorization: `Bearer ${jwt}` }
  const servico = SB_SERVICE()
  if (!servico) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY na Vercel para a rotina automática.')
  return { apikey: servico, Authorization: `Bearer ${servico}` }
}

export async function lerColecao(colecao, cabecalhos, { limite = 2000 } = {}) {
  const r = await fetch(
    `${SB_URL()}/rest/v1/orc_registros?colecao=eq.${colecao}&excluido=eq.false&select=id,dados&limit=${limite}`,
    { headers: cabecalhos },
  )
  if (!r.ok) throw new Error(`Não consegui ler ${colecao}: ${await r.text()}`)
  return (await r.json()).map((l) => l.dados)
}

export async function gravar(colecao, itens, cabecalhos, userId) {
  if (!itens.length) return
  const agora = new Date().toISOString()
  const unicos = [...new Map(itens.map((i) => [String(i.id), i])).values()]
  const linhas = unicos.map((i) => ({
    ...(userId ? { user_id: userId } : {}),
    colecao, id: String(i.id), dados: i, excluido: false, atualizado_em: agora,
  }))
  const r = await fetch(`${SB_URL()}/rest/v1/orc_registros?on_conflict=colecao,id`, {
    method: 'POST',
    headers: { ...cabecalhos, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(linhas),
  })
  if (!r.ok) throw new Error(`Não consegui gravar em ${colecao}: ${await r.text()}`)
}

// Quem é o dono, para carimbar user_id nas linhas criadas pelo cron.
export async function donoDoSistema(cabecalhos) {
  const r = await fetch(`${SB_URL()}/rest/v1/orc_registros?select=user_id&limit=1`, { headers: cabecalhos })
  if (!r.ok) return null
  const linhas = await r.json()
  return linhas?.[0]?.user_id || null
}

export async function lerConfig(cabecalhos) {
  const r = await fetch(
    `${SB_URL()}/rest/v1/orc_registros?colecao=eq.config&id=eq.prospect&select=dados`,
    { headers: cabecalhos },
  )
  if (!r.ok) return CONFIG_PADRAO
  const linhas = await r.json()
  const guardada = linhas?.[0]?.dados || {}
  return {
    ...CONFIG_PADRAO, ...guardada,
    pesos: { ...CONFIG_PADRAO.pesos, ...(guardada.pesos || {}) },
  }
}

/* ===== identidade e duplicidade ===== */

const soLetras = (t) => String(t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\b(condominio|edificio|residencial|ltda|me|epp|sa|s\/a|eireli|administradora|adm)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

export const soDigitos = (t) => String(t || '').replace(/\D/g, '')

// Chaves pelas quais dois registros são a mesma empresa.
export function chavesDoLead(lead) {
  const chaves = []
  const cnpj = soDigitos(lead.cnpj)
  if (cnpj.length === 14) chaves.push(`cnpj:${cnpj}`)
  const tel = soDigitos(lead.telefone)
  if (tel.length >= 10) chaves.push(`tel:${tel.slice(-10)}`)
  const site = String(lead.site || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
  if (site) chaves.push(`site:${site}`)
  const nome = soLetras(lead.nome)
  if (nome.length >= 5) chaves.push(`nome:${nome}|${soLetras(lead.cidade)}`)
  const end = soLetras(lead.endereco)
  if (end.length >= 10) chaves.push(`end:${end}`)
  return chaves
}

// Índice das chaves já conhecidas → id do lead existente.
export function indiceDeChaves(leads) {
  const idx = new Map()
  for (const l of leads) for (const c of chavesDoLead(l)) if (!idx.has(c)) idx.set(c, l.id)
  return idx
}
export const jaConhecido = (lead, idx) => {
  for (const c of chavesDoLead(lead)) if (idx.has(c)) return idx.get(c)
  return null
}

/* ===== pontuação ===== */

const nota = (v) => Math.max(0, Math.min(3, Number(v) || 0)) / 3

// Pontuação explicável: cada critério vira uma linha com o que valeu e por quê.
export function pontuar(lead, cfg = CONFIG_PADRAO) {
  const p = cfg.pesos
  const a = lead.avaliacao || {}
  const temContato = !!(lead.telefone || lead.email || lead.whatsapp || lead.paginaContato)
  const contatoForte = !!((lead.telefone || lead.whatsapp) && (lead.email || lead.paginaContato))

  const criterios = [
    { chave: 'compatibilidade', peso: p.compatibilidade, fracao: nota(a.compatibilidade),
      texto: 'Quanto o que a Vigiar faz bate com o que esse cliente usa' },
    { chave: 'recorrencia', peso: p.recorrencia, fracao: nota(a.recorrencia),
      texto: 'Chance de virar contrato mensal de manutenção' },
    { chave: 'contato', peso: p.contato, fracao: contatoForte ? 1 : temContato ? 0.6 : 0,
      texto: contatoForte ? 'Telefone e e-mail/página de contato públicos' : temContato ? 'Um canal de contato público' : 'Sem canal de contato encontrado' },
    { chave: 'evidencia', peso: p.evidencia, fracao: nota(a.evidencia),
      texto: 'Força do sinal de que existe necessidade' },
    { chave: 'porte', peso: p.porte, fracao: nota(a.porte),
      texto: 'Tamanho e capacidade de contratar' },
    { chave: 'localizacao', peso: p.localizacao, fracao: cfg.cidades.some((c) => soLetras(c).startsWith(soLetras(lead.cidade))) ? 1 : 0.3,
      texto: 'Deslocamento viável a partir da base' },
    { chave: 'abordagem', peso: p.abordagem, fracao: nota(a.abordagem),
      texto: 'Facilidade de chegar em quem decide' },
  ].map((c) => ({ ...c, pontos: Math.round(c.peso * c.fracao) }))

  // Informação frouxa não pode virar prioridade alta.
  const bruto = criterios.reduce((s, c) => s + c.pontos, 0)
  const corte = lead.confiabilidade === 'baixa' ? 0.75 : lead.confiabilidade === 'media' ? 0.9 : 1
  const total = Math.max(0, Math.min(100, Math.round(bruto * corte)))
  return { total, criterios, corteConfiabilidade: corte }
}

/* ===== modelo ===== */

export async function chamarModelo({ sistema, mensagens, ferramentas, maxTokens = 8000 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY na Vercel.')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      ...(WORKSPACE ? { 'anthropic-workspace-id': WORKSPACE } : {}),
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      output_config: { effort: 'medium' },
      system: sistema,
      ...(ferramentas ? { tools: ferramentas } : {}),
      messages: mensagens,
    }),
  })
  const dados = await r.json()
  if (!r.ok) throw new Error(dados?.error?.message || `Anthropic respondeu ${r.status}`)
  return dados
}

// Busca na web de verdade, rodando no servidor da Anthropic.
export const FERRAMENTA_BUSCA = [{
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: Number(process.env.PROSPECT_MAX_BUSCAS || 12),
  user_location: { type: 'approximate', country: 'BR', region: 'Minas Gerais', city: 'Belo Horizonte', timezone: 'America/Sao_Paulo' },
}]

export const textoDe = (content) =>
  (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')

// Lê o JSON que o modelo escreveu, mesmo vindo cercado de texto ou de crase.
export function extrairJSON(texto) {
  const limpo = String(texto || '').replace(/```json?/gi, '').replace(/```/g, '')
  const ini = limpo.indexOf('[') >= 0 && (limpo.indexOf('[') < limpo.indexOf('{') || limpo.indexOf('{') < 0)
    ? limpo.indexOf('[') : limpo.indexOf('{')
  if (ini < 0) return null
  const fim = Math.max(limpo.lastIndexOf(']'), limpo.lastIndexOf('}'))
  if (fim <= ini) return null
  try { return JSON.parse(limpo.slice(ini, fim + 1)) } catch { return null }
}

// Quantas fontes distintas sustentam a ficha.
export const dominiosDasFontes = (fontes = []) => [...new Set(
  fontes.map((f) => String(f?.url || f || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]).filter(Boolean),
)]

export const hojeBR = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

export const idDe = (prefixo) => `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
