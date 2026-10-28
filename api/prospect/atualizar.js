// Move o lead no funil e registra o que aconteceu no contato — tudo lançado à mão pelo Gelvan.
// Este endereço NÃO envia mensagem para ninguém. Só anota.
import { ESTAGIOS, auth, gravar, gravarConfig, lerColecao, lerConfig } from './_lib.js'
import { usuarioDoToken } from '../ml/_lib.js'

const jwtDa = (req) => {
  const a = req.headers.authorization || ''
  return a.startsWith('Bearer ') ? a.slice(7) : ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })

  const jwt = jwtDa(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })

  const { acao, leadId, estagio, anotacao, campos } = req.body || {}

  // Liga e desliga a prospecção inteira. Pausada, a rotina da manhã não procura nem gasta busca.
  if (acao === 'pausar') {
    const pausar = req.body?.pausar !== false
    try {
      const cabecalhos = auth({ jwt })
      const cfg = await lerConfig(cabecalhos)
      const novo = {
        ...cfg,
        pausado: pausar,
        pausadoEm: pausar ? new Date().toISOString() : null,
        pausadoPor: pausar ? dono.email : '',
        motivoPausa: pausar ? String(req.body?.motivo || '').slice(0, 300) : '',
      }
      await gravarConfig(cabecalhos, dono.id, novo)
      return res.status(200).json({
        ok: true, pausado: pausar, cfg: novo,
        mensagem: pausar
          ? 'Prospecção pausada. Não vou procurar cliente novo até você mandar voltar.'
          : 'Prospecção religada. Volto a procurar na próxima rotina da manhã.',
      })
    } catch (e) {
      console.error('prospect/pausar', e)
      return res.status(502).json({ erro: String(e.message || e) })
    }
  }

  if (!leadId) return res.status(400).json({ erro: 'Diga qual lead.' })
  if (estagio && !ESTAGIOS.includes(estagio)) return res.status(400).json({ erro: `Estágio desconhecido: ${estagio}` })

  try {
    const cabecalhos = auth({ jwt })
    const leads = await lerColecao('prospect_leads', cabecalhos)
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' })

    const historico = Array.isArray(lead.historico) ? [...lead.historico] : []
    if (estagio && estagio !== lead.estagio) {
      historico.push({ em: new Date().toISOString(), de: lead.estagio, para: estagio, por: dono.email })
    }
    if (anotacao) historico.push({ em: new Date().toISOString(), nota: String(anotacao).slice(0, 2000), por: dono.email })

    // Só deixo editar o que é de contato: o resto é resultado da pesquisa.
    const editaveis = ['telefone', 'email', 'whatsapp', 'site', 'endereco', 'bairro', 'paginaContato', 'servicoRecomendado']
    const extras = {}
    for (const c of editaveis) if (campos && campos[c] !== undefined) extras[c] = campos[c]

    const novo = {
      ...lead, ...extras,
      estagio: estagio || lead.estagio,
      historico,
      atualizadoEm: new Date().toISOString(),
    }
    await gravar('prospect_leads', [novo], cabecalhos, dono.id)
    return res.status(200).json({ ok: true, lead: novo })
  } catch (e) {
    console.error('prospect/atualizar', e)
    return res.status(502).json({ erro: String(e.message || e) })
  }
}
