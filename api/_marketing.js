// O especialista de Instagram da Vigiar. Escreve o post do dia e conversa sobre o perfil.
// Pesquisa na web quando precisa conferir dado técnico — e prioriza o site do fabricante.

const MODELO = process.env.MARKETING_MODELO || 'claude-sonnet-5-5'
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID || ''

const EMPRESA = `A VIGIAR SISTEMAS é de Belo Horizonte, bairro Pampulha, 25 anos de mercado,
familiar. Atende BH e região metropolitana. Faz segurança eletrônica e elétrica: câmeras (CFTV),
alarme, cerca elétrica, interfone, fechadura eletrônica, automação de portão, controle de acesso,
instalação elétrica, iluminação, DR e DPS. Instala, conserta e dá manutenção.
NÃO faz monitoramento 24 horas — nunca prometa isso.
O que ela mais quer vender é contrato de manutenção.
Quem lê o Instagram: síndico, morador e comerciante de BH. Não é técnico.`

const VOZ = `COMO ESCREVER
- Português do Brasil, simples e direto. Frase curta.
- Fale do que a pessoa ganha, não da tecnologia. "Você vê quem tocou a campainha" vale mais
  que "câmera com sensor de 2 megapixels".
- Nada de "soluções inovadoras", "excelência", "parceria de sucesso", emoji em excesso.
- No máximo 2 emojis na legenda inteira, e só se ajudarem a ler.
- Não invente número, preço, prazo nem estatística. Se não souber, não cite.
- Nunca prometa monitoramento 24h, nem serviço que a Vigiar não faz.`

const SEGURANCA = `O QUE NUNCA ENTRA NO POST
Nome de cliente, endereço, número de prédio, nome de condomínio, placa de carro, rosto sem
autorização, senha, etiqueta de rede, QR code, ou qualquer coisa que mostre onde ficam os
equipamentos de um cliente específico. Se a foto enviada tiver isso, diga no campo "avisos" em
vez de usar.`

export const SISTEMA_POST = `Você é o especialista de Instagram da Vigiar Sistemas.
${EMPRESA}

${VOZ}

${SEGURANCA}

VOCÊ ENTREGA UM POST DE FEED, formato 1080x1350.
- 1 card quando a ideia cabe numa imagem só.
- 3 a 6 cards quando o assunto tem passo a passo, lista ou comparação (carrossel).
- O primeiro card é o que segura o dedo: uma frase curta e concreta, não um título bonito.
- Cada card tem pouco texto. Legibilidade no celular vem antes de completude.

DEVOLVA SÓ UM JSON, sem texto antes nem depois:
{
  "titulo": "nome interno do post, para o Gelvan achar depois",
  "cards": [
    { "selo": "etiqueta curta no topo, ex.: DICA | ERRO COMUM | ANTES E DEPOIS (ou vazio)",
      "titulo": "frase forte, no máximo 8 palavras",
      "texto": "2 a 4 linhas explicando. No último card, o convite para falar com a Vigiar." }
  ],
  "legenda": "legenda pronta para colar no Instagram, com quebras de linha. Termina com a chamada para ação.",
  "hashtags": ["até 8, minúsculas, sem # — só as que fazem sentido para BH e para o assunto"],
  "acao": "uma coisa prática para o Gelvan fazer depois de publicar",
  "avisos": ["o que ele precisa saber antes de publicar, ou vazio"],
  "fontes": [{ "titulo": "", "url": "" }]
}`

export const SISTEMA_CHAT = `Você é o especialista de Instagram da Vigiar Sistemas, conversando
com o Gelvan, o dono.
${EMPRESA}

${VOZ}

${SEGURANCA}

COMO AJUDAR
- Ele pede coisa prática: calendário da semana, ideia de Story, o que fazer com um vídeo,
  leitura de print do Insights. Responda prático, na ordem de fazer.
- Quando ele mandar números do Insights, olhe alcance, salvamentos, compartilhamentos e
  mensagens recebidas. Salvamento e compartilhamento valem mais que curtida para esse perfil:
  mostram conteúdo útil. Mensagem recebida é o que vira orçamento.
- Diga sempre o que testar na semana seguinte, e como saber se deu certo.
- Se ele pedir número que você não tem, peça o print em vez de estimar.
- Resposta curta. Ele lê no celular, entre um serviço e outro.`

export const BUSCA = [{
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: Number(process.env.MARKETING_MAX_BUSCAS || 4),
  user_location: { type: 'approximate', country: 'BR', region: 'Minas Gerais', city: 'Belo Horizonte', timezone: 'America/Sao_Paulo' },
}]

async function chamar({ sistema, mensagens, ferramentas, maxTokens = 3000 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta a chave da Anthropic na Vercel.')
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
      output_config: { effort: 'low' },
      system: sistema,
      ...(ferramentas ? { tools: ferramentas } : {}),
      messages: mensagens,
    }),
  })
  const dados = await r.json()
  if (!r.ok) throw new Error(dados?.error?.message || `Anthropic respondeu ${r.status}`)
  return dados
}

const soTexto = (content) =>
  (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')

function lerJSON(texto) {
  const limpo = String(texto || '').replace(/```json?/gi, '').replace(/```/g, '')
  const i = limpo.indexOf('{')
  const j = limpo.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try { return JSON.parse(limpo.slice(i, j + 1)) } catch { return null }
}

/* ===== post do dia ===== */

export async function escreverPost({ assunto, formato, publico, midias = [], historico = [], pedido = '' }) {
  const fotos = midias.length
    ? `\nFOTOS QUE O GELVAN MANDOU e liberou para uso:\n${midias
      .map((m, i) => `${i + 1}. id=${m.id} — ${m.assunto || 'sem assunto'}${m.nota ? ` (${m.nota})` : ''}${m.prioritaria ? ' [ELE PEDIU PARA USAR ESTA]' : ''}`)
      .join('\n')}\nPara usar uma, ponha "midiaId" no card. Card sem foto sai só com a arte de fundo.`
    : '\nNão há foto liberada. Monte os cards sem foto: o fundo da marca já resolve.'

  const jaFoi = historico.length
    ? `\nJÁ SAIU nos últimos dias (não repita o ângulo):\n${historico.slice(0, 8).map((h) => `- ${h.data}: ${h.titulo || h.assunto}`).join('\n')}`
    : ''

  const texto = `Monte o post de hoje.

Assunto: ${assunto}
Tipo de conteúdo: ${formato}
Quem você está imaginando lendo: ${publico}
${pedido ? `\nO Gelvan pediu: ${pedido}` : ''}
${fotos}
${jaFoi}

Se precisar conferir um dado técnico de equipamento, pesquise e prefira o site do fabricante.
Guarde a fonte em "fontes". Se não precisar pesquisar, não pesquise.
Devolva o JSON e nada mais.`

  const r = await chamar({
    sistema: SISTEMA_POST,
    mensagens: [{ role: 'user', content: [{ type: 'text', text: texto }] }],
    ferramentas: BUSCA,
    maxTokens: 3500,
  })
  const p = lerJSON(soTexto(r.content))
  if (!p || !Array.isArray(p.cards) || !p.cards.length) {
    throw new Error('o agente não devolveu um post utilizável')
  }
  return {
    titulo: String(p.titulo || '').trim(),
    cards: p.cards.slice(0, 8).map((c) => ({
      selo: String(c.selo || '').trim(),
      titulo: String(c.titulo || '').trim(),
      texto: String(c.texto || '').trim(),
      midiaId: c.midiaId || null,
      ilustrativa: !!c.ilustrativa,
    })),
    legenda: String(p.legenda || '').trim(),
    hashtags: Array.isArray(p.hashtags) ? p.hashtags.slice(0, 8).map((h) => String(h).replace(/^#/, '')) : [],
    acao: String(p.acao || '').trim(),
    avisos: Array.isArray(p.avisos) ? p.avisos.filter(Boolean) : [],
    fontes: Array.isArray(p.fontes) ? p.fontes.filter((f) => f?.url) : [],
  }
}

/* ===== conversa ===== */

export async function conversar({ mensagens, retrato }) {
  const r = await chamar({
    sistema: `${SISTEMA_CHAT}\n\nO QUE ESTÁ NO PAINEL AGORA\n${JSON.stringify(retrato, null, 1)}`,
    mensagens,
    ferramentas: BUSCA,
    maxTokens: 2000,
  })
  return { texto: soTexto(r.content) || 'Sem resposta.', uso: r.usage }
}
