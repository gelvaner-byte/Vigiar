// TRON — cérebro do assistente do Centro de Comando.
// Roda no servidor da Vercel: a chave da Anthropic nunca chega ao navegador.
// Só responde a quem está logado no app E consta na lista de donos.
// O TRON coordena especialistas (ver personas.js): ele pode consultá-los no meio da resposta.

import { PERSONAS, ESPECIALISTAS } from './personas.js'

const MODELO = process.env.TRON_MODELO || 'claude-sonnet-5-5'
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || ''
const MAX_TOKENS = 1600
const MAX_TOKENS_ESPECIALISTA = 1200
const MAX_CONSULTAS = 3   // teto de consultas por pergunta: consulta custa dinheiro

const FERRAMENTAS = [
  {
    name: 'criar_cliente',
    description: 'Cadastra um cliente novo. Use quando a pessoa ainda não existir na lista de clientes.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        telefone: { type: 'string' },
        endereco: { type: 'string', description: 'Rua e número' },
        bairro: { type: 'string' },
        origem: { type: 'string', description: 'Instagram, Google, Indicação, Placa / carro, Cliente antigo…' },
        observacoes: { type: 'string' },
      },
      required: ['nome'],
    },
  },
  {
    name: 'criar_orcamento',
    description: 'Agenda a visita de orçamento para um cliente já cadastrado.',
    input_schema: {
      type: 'object',
      properties: {
        clienteId: { type: 'string', description: 'id do cliente existente' },
        dataVisita: { type: 'string', description: 'AAAA-MM-DD' },
        horaVisita: { type: 'string', description: 'HH:MM' },
        descricaoServico: { type: 'string', description: 'O que o cliente quer' },
        vendedor: { type: 'string' },
      },
      required: ['clienteId', 'dataVisita'],
    },
  },
  {
    name: 'agendar_servico',
    description: 'Cria a ordem de serviço e agenda a execução. Use horário livre dentro do expediente.',
    input_schema: {
      type: 'object',
      properties: {
        clienteId: { type: 'string' },
        orcamentoId: { type: 'string', description: 'id do orçamento aprovado, quando vier de um' },
        dataServico: { type: 'string', description: 'AAAA-MM-DD' },
        horaServico: { type: 'string', description: 'HH:MM' },
        duracaoHoras: { type: 'number' },
        descricao: { type: 'string' },
        valor: { type: 'number' },
      },
      required: ['clienteId', 'dataServico', 'horaServico'],
    },
  },
  {
    name: 'salvar_memoria',
    description: 'Guarda no Cérebro um conhecimento da empresa que vale usar depois: preço, garantia, fornecedor, procedimento, modelo de mensagem, regra da casa.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Curto e direto. Ex.: Preço da câmera bullet instalada' },
        categoria: {
          type: 'string',
          enum: ['Preços', 'Garantia', 'Fornecedores', 'Procedimentos', 'Mensagens prontas', 'Regras da casa', 'Marketing', 'Outros'],
        },
        conteudo: { type: 'string', description: 'O conhecimento em si, escrito para ser lido depois' },
      },
      required: ['titulo', 'conteudo'],
    },
  },
  {
    name: 'mudar_status_orcamento',
    description: 'Muda a situação de um orçamento: a_enviar, enviado, aprovado ou recusado.',
    input_schema: {
      type: 'object',
      properties: {
        orcamentoId: { type: 'string' },
        status: { type: 'string', enum: ['agendado', 'a_enviar', 'enviado', 'aprovado', 'recusado'] },
        motivo: { type: 'string' },
      },
      required: ['orcamentoId', 'status'],
    },
  },
]


// Ferramenta que só o TRON tem: pedir a análise de um especialista.
const CONSULTAR = {
  name: 'consultar_especialista',
  description: 'Pede a análise de um especialista da equipe. Use quando a pergunta exigir conhecimento de dinheiro, marketing, anúncio pago ou Mercado Livre.',
  input_schema: {
    type: 'object',
    properties: {
      especialista: { type: 'string', enum: ESPECIALISTAS },
      pergunta: { type: 'string', description: 'Pergunta específica, já dizendo o que você sabe do sistema' },
    },
    required: ['especialista', 'pergunta'],
  },
}

const ferramentasDe = (agente) =>
  agente === 'tron'
    ? [...FERRAMENTAS, CONSULTAR]
    : FERRAMENTAS.filter((f) => f.name === 'salvar_memoria')

// Confere se quem chamou está logado no app e é dono.
async function donoAutenticado(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const user = await r.json()
  const email = String(user?.email || '').toLowerCase()
  const donos = String(process.env.TRON_DONOS || 'acesso@vigiar.app')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return donos.includes(email) ? email : null
}

async function chamarModelo({ perfil, retrato, mensagens, ferramentas, maxTokens }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      // Chave com escopo de organização precisa dizer em qual workspace gastar.
      ...(WORKSPACE ? { 'anthropic-workspace-id': WORKSPACE } : {}),
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      // Sem "pensar antes de responder": é conversa em cima de dados prontos, e assim responde rápido.
      thinking: { type: 'between_tools' },
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: perfil }, { type: 'text', text: retrato }],
      ...(ferramentas && ferramentas.length ? { tools: ferramentas } : {}),
      messages: mensagens,
    }),
  })
  const dados = await r.json()
  if (!r.ok) {
    console.error('anthropic', r.status, dados)
    throw new Error(dados?.error?.message || `erro ${r.status}`)
  }
  return dados
}

const soTexto = (content) => (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ erro: 'TRON ainda não está configurado: falta a chave ANTHROPIC_API_KEY na Vercel.' })
  }

  const email = await donoAutenticado(req)
  if (!email) return res.status(401).json({ erro: 'Entre no app com a conta do dono para falar com o TRON.' })

  const { mensagens = [], contexto = {}, agente = 'tron' } = req.body || {}
  if (!Array.isArray(mensagens) || mensagens.length === 0) return res.status(400).json({ erro: 'Sem mensagem.' })

  const persona = PERSONAS[agente] || PERSONAS.tron
  const retrato = `RETRATO DO SISTEMA (dados reais, agora)\nHoje: ${contexto.hoje}\n\n${JSON.stringify(contexto, null, 1)}`

  try {
    let conversa = mensagens
    const consultas = []   // o que cada especialista respondeu, para mostrar na tela
    let resposta

    // O TRON pode consultar especialistas antes de responder. Cada consulta roda aqui no
    // servidor e volta para ele — o Gelvan só vê o resultado final mais os pareceres.
    for (let volta = 0; volta <= MAX_CONSULTAS; volta++) {
      resposta = await chamarModelo({
        perfil: persona.texto, retrato, mensagens: conversa,
        ferramentas: ferramentasDe(agente), maxTokens: MAX_TOKENS,
      })

      const pedidos = (resposta.content || []).filter(
        (b) => b.type === 'tool_use' && b.name === 'consultar_especialista',
      )
      const outrasAcoes = (resposta.content || []).some(
        (b) => b.type === 'tool_use' && b.name !== 'consultar_especialista',
      )
      // Ação que mexe no sistema volta para o dono confirmar: para o laço aqui.
      if (!pedidos.length || outrasAcoes || volta === MAX_CONSULTAS) break

      const resultados = []
      for (const pedido of pedidos) {
        const quem = pedido.input?.especialista
        const pergunta = String(pedido.input?.pergunta || '').trim()
        const esp = PERSONAS[quem]
        if (!esp || !ESPECIALISTAS.includes(quem)) {
          resultados.push({ type: 'tool_result', tool_use_id: pedido.id, content: 'Especialista desconhecido.' })
          continue
        }
        const parecer = await chamarModelo({
          perfil: esp.texto, retrato,
          mensagens: [{ role: 'user', content: [{ type: 'text', text: pergunta }] }],
          ferramentas: [], maxTokens: MAX_TOKENS_ESPECIALISTA,
        })
        const texto = soTexto(parecer.content) || 'Sem resposta.'
        consultas.push({ especialista: quem, nome: esp.nome, pergunta, resposta: texto })
        resultados.push({ type: 'tool_result', tool_use_id: pedido.id, content: texto })
      }

      conversa = [
        ...conversa,
        { role: 'assistant', content: resposta.content },
        { role: 'user', content: resultados },
      ]
    }

    return res.status(200).json({
      content: resposta.content,
      stop_reason: resposta.stop_reason,
      consultas,
      uso: resposta.usage,
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ erro: 'Falha ao falar com o TRON: ' + String(e.message || e) })
  }
}
