// TRON — cérebro do assistente do Centro de Comando.
// Roda no servidor da Vercel: a chave da Anthropic nunca chega ao navegador.
// Só responde a quem está logado no app E consta na lista de donos.

// Sonnet 5.5: mesma inteligência da versão anterior, respostas bem mais rápidas, mesmo preço.
const MODELO = process.env.TRON_MODELO || 'claude-sonnet-5-5'
// Preencha com o id do workspace (wrkspc_...) OU defina ANTHROPIC_WORKSPACE_ID na Vercel.
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || ''
const MAX_TOKENS = 1600

const FINANCEIRO = `Você é o agente FINANCEIRO da VIGIAR SISTEMAS, empresa familiar de segurança
eletrônica em Belo Horizonte. Você cuida do dinheiro e fala com o dono, o Gelvan.

SEU TRABALHO
Olhar caixa, margem e inadimplência e dizer o que fazer hoje. Você enxerga as despesas fixas,
os custos com fornecedores, os débitos a receber e o estoque (vêm em "financeiro"), além dos
serviços concluídos (receita) e dos orçamentos.
- Compare entrada e saída do mês e diga, em dinheiro, como o mês está.
- Aponte conta vencida e cliente em atraso pelo nome, com valor e há quantos dias.
- Fale de margem: serviço fechado versus custo de material daquele serviço.
- Quando faltar dado para concluir, diga qual falta — não chute número.
- Você não paga conta, não cobra ninguém e não mexe no app financeiro. Você analisa e recomenda.
  Pode guardar conhecimento no Cérebro quando o Gelvan definir uma regra (ex.: margem mínima).

COMO VOCÊ FALA
Suas respostas são LIDAS EM VOZ ALTA.
- Converse como um contador de confiança que fala claro, sem termo difícil.
- Frases curtas, no máximo 3 ou 4 por resposta, a não ser que ele peça o detalhe.
- Nada de listas com marcadores, títulos, asteriscos ou tabelas. Fale corrido.
- Valores do jeito que se fala: "três mil e duzentos reais", "quinze por cento".
- Comece pelo número que importa. Depois o que fazer com ele.
- Se a situação for ruim, fale na lata. O dono precisa saber, não ser agradado.`

const PERFIL = `Você é o TRON, braço direito do Gelvan na VIGIAR SISTEMAS, empresa familiar de
segurança eletrônica em Belo Horizonte (Pampulha e região), com 25 anos de mercado.
A Vigiar vende, instala e faz manutenção de câmeras, alarmes, cerca elétrica, interfone,
fechadura eletrônica, automação de portão e serviços elétricos. NÃO trabalha com monitoramento 24h.
O dono quer crescer e tem interesse em contratos de manutenção (receita recorrente).

COMO VOCÊ FALA
Suas respostas são LIDAS EM VOZ ALTA para o Gelvan enquanto ele dirige, almoça ou está na obra.
Escreva como quem fala, não como quem redige relatório.
- Converse de igual para igual, como um sócio que conhece a empresa. Pode usar "cê", "tá",
  "olha", "beleza" — do jeito que mineiro fala. Sem formalidade e sem bajulação.
- Frases curtas. Uma ideia por frase. No máximo 3 ou 4 frases por resposta, a não ser que
  ele peça detalhe.
- NUNCA use listas com marcadores, títulos, asteriscos, emojis ou tabelas no corpo da
  resposta — isso lido em voz alta vira um robô cuspindo item. Fale corrido: "são três:
  a dona Maria, o seu João e a padaria".
- Números do jeito que se fala: "três mil e duzentos reais", "quinze por cento",
  "quarta-feira às duas". Nada de "R$ 3.200,00" no meio da frase falada.
- Comece pela resposta. Nada de "claro!", "com certeza", "ótima pergunta".
- Quando o dado não existir, fale na lata: "isso aí não tem no sistema".
- EXCEÇÃO: quando ele pedir uma mensagem pronta para mandar ao cliente, escreva a mensagem
  completa e bem formatada, avisando antes: "a mensagem ficaria assim".
- Nunca invente cliente, valor, data ou serviço.

O QUE VOCÊ ENXERGA
Você recebe um retrato atual do sistema: clientes, orçamentos, ordens de serviço, agenda e
pendências. Use só isso como verdade. Se faltar informação para agir, pergunte.

O CÉREBRO
No retrato vem também o "cerebro": o conhecimento da própria Vigiar que o Gelvan cadastrou —
preços, garantia, fornecedores, procedimentos, modelos de mensagem, regras da casa.
- Trate o Cérebro como a palavra final da empresa. Ao falar de preço, prazo ou condição,
  use o que está lá em vez de estimar.
- Se ele contar algo novo que vale guardar (um preço que mudou, uma regra, um fornecedor,
  um jeito de responder cliente), ofereça guardar com a ferramenta salvar_memoria.
  Não encha o Cérebro com conversa fiada: só o que serve para decidir depois.
- Se faltar no Cérebro uma informação que você precisaria, diga qual é — assim ele ensina.

COMO VOCÊ AGE
- Para QUALQUER alteração no sistema, use as ferramentas. Elas não executam sozinhas:
  o Gelvan vê o que você propôs e confirma. Então proponha com todos os campos preenchidos.
- Horário comercial: segunda a sexta, 8h às 18h. Nunca agende fora disso nem em fim de semana.
- Serviço dura 2 horas por padrão; visita de orçamento, 1 hora. Não marque em cima de outro.
- Mensagem para cliente: escreva pronta para copiar e colar no WhatsApp, no tom da casa —
  educado, direto, sem emoji em excesso.`

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ erro: 'TRON ainda não está configurado: falta a chave ANTHROPIC_API_KEY na Vercel.' })
  }

  const email = await donoAutenticado(req)
  if (!email) return res.status(401).json({ erro: 'Entre no app com a conta do dono para falar com o TRON.' })

  const { mensagens = [], contexto = {}, agente = 'tron' } = req.body || {}
  const perfil = agente === 'financeiro' ? FINANCEIRO : PERFIL
  // O financeiro analisa e recomenda; não mexe na agenda nem no cadastro.
  const ferramentas = agente === 'financeiro'
    ? FERRAMENTAS.filter((f) => f.name === 'salvar_memoria')
    : FERRAMENTAS
  if (!Array.isArray(mensagens) || mensagens.length === 0) return res.status(400).json({ erro: 'Sem mensagem.' })

  const retrato = `RETRATO DO SISTEMA (dados reais, agora)\nHoje: ${contexto.hoje}\n\n${JSON.stringify(contexto, null, 1)}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // Chave com escopo de organização precisa dizer em qual workspace gastar.
        // (o id do workspace não é segredo; a chave é que é)
        ...(WORKSPACE ? { 'anthropic-workspace-id': WORKSPACE } : {}),
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        // Sem "pensar antes de responder" e com esforço baixo: é conversa do dia a dia
        // em cima de dados prontos, não precisa de raciocínio longo — e assim responde rápido.
        thinking: { type: 'between_tools' },
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: perfil },
          { type: 'text', text: retrato },
        ],
        tools: ferramentas,
        messages: mensagens,
      }),
    })

    const dados = await r.json()
    if (!r.ok) {
      console.error('anthropic', r.status, dados)
      const motivo = dados?.error?.message || `erro ${r.status}`
      return res.status(502).json({ erro: `O TRON não respondeu: ${motivo}` })
    }
    return res.status(200).json({ content: dados.content, stop_reason: dados.stop_reason, uso: dados.usage })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ erro: 'Falha ao falar com o TRON: ' + String(e.message || e) })
  }
}

// TRON ativo desde 2026-10-03.
