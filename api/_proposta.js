// O agente que escreve a proposta. Recebe só o necessário para redigir: o que o cliente
// pediu e a lista de itens. Valor, desconto, pagamento e garantia NÃO passam por aqui —
// esses o app preenche do orçamento, para o modelo não ter como errar número.

const MODELO = process.env.PROPOSTA_MODELO || 'claude-sonnet-5-5'
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || ''

const SISTEMA = `Você escreve propostas comerciais da VIGIAR SISTEMAS, empresa de segurança
eletrônica de Belo Horizonte, com mais de 25 anos de mercado. Ela instala e dá manutenção em
câmeras, alarme, cerca elétrica, interfone, fechadura eletrônica, automação de portão e
serviços elétricos. Não faz monitoramento 24 horas.

QUEM VAI LER
O cliente ou o síndico. Alguém que não é técnico e precisa entender o que está contratando.

COMO ESCREVER
- Português do Brasil, profissional e direto. Sem palavra difícil e sem enfeite de vendedor.
- Frase curta. Nada de "soluções inovadoras", "parceria de sucesso", "excelência".
- Explique o que será feito, não o que a empresa acha de si mesma.

A REGRA QUE NÃO SE QUEBRA
Escreva SOMENTE sobre o que está na lista de itens e na descrição do serviço. Não mencione
acesso remoto pelo celular, aplicativo, treinamento, infraestrutura, garantia estendida,
backup em nuvem, manutenção inclusa ou visita de retorno — a não ser que apareça na lista.
Inventar escopo vira reclamação depois, porque o cliente cobra o que leu.
Não escreva valor, prazo, forma de pagamento nem prazo de garantia: isso o sistema preenche.

DEVOLVA SÓ UM JSON, sem texto antes nem depois:
{
  "necessidade": "uma ou duas frases dizendo o que o cliente precisa, na língua dele",
  "solucao": "duas a quatro frases dizendo o que a Vigiar vai entregar",
  "etapas": ["passo a passo do serviço, de 3 a 6 itens, cada um numa frase"],
  "fechamento": "uma ou duas frases de encerramento, sem promessa que não está no escopo"
}`

export async function redigirProposta({ descricaoServico, itens, local, tipoCliente }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('sem chave')

  const lista = (itens || [])
    .map((i) => `- ${i.qtd || 1}x ${i.descricao}${i.doCliente ? ' (material do cliente)' : ''}`)
    .join('\n')

  const pedido = `O cliente pediu: ${descricaoServico || '(não descrito)'}
${local ? `Local: ${local}` : ''}
${tipoCliente ? `Tipo de cliente: ${tipoCliente}` : ''}

Itens do orçamento:
${lista || '(sem itens)'}

Escreva a proposta falando só disto.`

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
      max_tokens: 1500,
      output_config: { effort: 'low' },
      system: SISTEMA,
      messages: [{ role: 'user', content: [{ type: 'text', text: pedido }] }],
    }),
  })
  const dados = await r.json()
  if (!r.ok) throw new Error(dados?.error?.message || `erro ${r.status}`)

  const texto = (dados.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  const limpo = texto.replace(/```json?/gi, '').replace(/```/g, '')
  const i = limpo.indexOf('{')
  const j = limpo.lastIndexOf('}')
  if (i < 0 || j <= i) throw new Error('o agente não devolveu o texto esperado')
  const p = JSON.parse(limpo.slice(i, j + 1))
  return {
    necessidade: String(p.necessidade || '').trim(),
    solucao: String(p.solucao || '').trim(),
    etapas: Array.isArray(p.etapas) ? p.etapas.map((e) => String(e).trim()).filter(Boolean) : [],
    fechamento: String(p.fechamento || '').trim(),
    porIA: true,
  }
}
