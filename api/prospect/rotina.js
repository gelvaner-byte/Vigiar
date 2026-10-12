// Rotina diária do TRON PROSPECT. A Vercel chama este endereço todo dia de manhã.
// Pesquisa, qualifica, tira os repetidos, grava as fichas e monta o relatório do dia.
// Roda no servidor: não depende de navegador aberto nem de ninguém estar logado.

import {
  auth, chavesDoLead, donoDoSistema, faixaDe, gravar, hojeBR, idDe, indiceDeChaves,
  jaConhecido, lerColecao, lerConfig, pontuar, dominiosDasFontes,
} from './_lib.js'
import { pesquisarSegmento } from './_pesquisa.js'

// Só a Vercel (ou o dono, pelo painel) dispara a rotina.
function autorizado(req) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return true   // sem segredo configurado, a Vercel ainda assim só expõe pelo cron
  const auth = req.headers.authorization || ''
  return auth === `Bearer ${segredo}`
}

// Uma ficha só entra se tiver o mínimo para alguém trabalhar nela.
function aproveitavel(f) {
  const temContato = !!(f.telefone || f.email || f.whatsapp || f.paginaContato)
  const temFonte = dominiosDasFontes(f.fontes).length > 0
  return !!f.nome && !!f.cidade && temContato && temFonte
}

function normalizar(ficha, cfg) {
  const base = {
    id: idDe('lead'),
    nome: String(ficha.nome || '').trim(),
    razaoSocial: ficha.razaoSocial || '',
    cnpj: ficha.cnpj || '',
    segmento: ficha.segmento || 'outro',
    subsegmento: ficha.subsegmento || '',
    cidade: ficha.cidade || '',
    bairro: ficha.bairro || '',
    endereco: ficha.endereco || '',
    site: ficha.site || '',
    telefone: ficha.telefone || '',
    email: ficha.email || '',
    whatsapp: ficha.whatsapp || '',
    paginaContato: ficha.paginaContato || '',
    servicosPossiveis: Array.isArray(ficha.servicosPossiveis) ? ficha.servicosPossiveis : [],
    servicoRecomendado: ficha.servicoRecomendado || '',
    evidencias: Array.isArray(ficha.evidencias) ? ficha.evidencias : [],
    equipamentos: ['confirmados', 'nao_confirmados', 'nao_identificados'].includes(ficha.equipamentos)
      ? ficha.equipamentos : 'nao_identificados',
    equipamentosDetalhe: ficha.equipamentosDetalhe || '',
    pendencias: Array.isArray(ficha.pendencias) ? ficha.pendencias : [],
    confiabilidade: ['alta', 'media', 'baixa'].includes(ficha.confiabilidade) ? ficha.confiabilidade : 'media',
    fontes: Array.isArray(ficha.fontes) ? ficha.fontes : [],
    avaliacao: ficha.avaliacao || {},
    justificativa: ficha.justificativa || '',
    abordagem: ficha.abordagem || {},
    estagio: 'pesquisa_concluida',
    historico: [],
    encontradoEm: hojeBR(),
    atualizadoEm: new Date().toISOString(),
  }
  const nota = pontuar(base, cfg)
  return { ...base, pontuacao: nota.total, criterios: nota.criterios, prioridade: faixaDe(nota.total).nome }
}

export async function rodarRotina({ cabecalhos, cfg, userId, pedidoLivre = '', segmentos = null, quantidadePorBusca = null }) {
  const existentes = await lerColecao('prospect_leads', cabecalhos)
  const indice = indiceDeChaves(existentes)
  const nomesConhecidos = existentes.map((l) => `${l.nome} (${l.cidade})`)

  const alvos = segmentos || ['administradora', 'condominio', 'comercio', 'construtora']
  const porBusca = quantidadePorBusca || Math.max(3, Math.ceil(cfg.metaDiaria / 2))

  // Cada cidade entra em uma rodada diferente para não concentrar tudo em BH.
  const rodadas = []
  alvos.forEach((seg, i) => {
    rodadas.push({ segmento: seg, cidade: cfg.cidades[i % cfg.cidades.length] })
  })

  const novos = []
  const atualizados = []
  const falhas = []
  let consultas = 0

  for (const rodada of rodadas) {
    if (novos.length >= cfg.metaDiaria && !pedidoLivre) break
    try {
      const r = await pesquisarSegmento({
        ...rodada, quantidade: porBusca, cfg, pedidoLivre,
        evitar: nomesConhecidos,
      })
      consultas += r.busca.consultas
      if (r.busca.erros.length) falhas.push(`busca ${rodada.segmento}/${rodada.cidade}: ${r.busca.erros.join(', ')}`)

      for (const ficha of r.fichas) {
        if (!aproveitavel(ficha)) continue
        const lead = normalizar(ficha, cfg)
        const idIgual = jaConhecido(lead, indice)
        if (idIgual) {
          // Já existe: só completa o que faltava, sem mexer no estágio nem no histórico.
          const antigo = existentes.find((l) => l.id === idIgual)
          if (!antigo) continue
          const mesclado = { ...antigo }
          let mudou = false
          for (const campo of ['telefone', 'email', 'whatsapp', 'site', 'endereco', 'bairro', 'cnpj', 'paginaContato']) {
            if (!mesclado[campo] && lead[campo]) { mesclado[campo] = lead[campo]; mudou = true }
          }
          if (mudou) {
            mesclado.fontes = [...(mesclado.fontes || []), ...lead.fontes].slice(0, 12)
            mesclado.atualizadoEm = new Date().toISOString()
            const nota = pontuar(mesclado, cfg)
            mesclado.pontuacao = nota.total
            mesclado.criterios = nota.criterios
            mesclado.prioridade = faixaDe(nota.total).nome
            atualizados.push(mesclado)
          }
          continue
        }
        // Entra na base e já passa a contar como conhecido nesta mesma execução.
        novos.push(lead)
        existentes.push(lead)
        for (const c of chavesDoLead(lead)) indice.set(c, lead.id)
        nomesConhecidos.push(`${lead.nome} (${lead.cidade})`)
      }
    } catch (e) {
      falhas.push(`${rodada.segmento}/${rodada.cidade}: ${String(e.message || e)}`)
    }
  }

  if (novos.length || atualizados.length) {
    await gravar('prospect_leads', [...novos, ...atualizados], cabecalhos, userId)
  }

  const porCidade = {}
  const porSegmento = {}
  novos.forEach((l) => {
    porCidade[l.cidade] = (porCidade[l.cidade] || 0) + 1
    porSegmento[l.segmento] = (porSegmento[l.segmento] || 0) + 1
  })
  const alta = novos.filter((l) => l.prioridade === 'alta')
  const recorrentes = novos.filter((l) => (Number(l.avaliacao?.recorrencia) || 0) >= 2)

  const relatorio = {
    id: hojeBR(),
    data: hojeBR(),
    geradoEm: new Date().toISOString(),
    metaDiaria: cfg.metaDiaria,
    cidades: cfg.cidades,
    consultasWeb: consultas,
    novos: novos.length,
    atualizados: atualizados.length,
    qualificados: novos.filter((l) => l.pontuacao >= 60).length,
    alta: alta.length,
    recorrentes: recorrentes.length,
    porCidade, porSegmento,
    destaques: [...novos].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 5)
      .map((l) => ({ id: l.id, nome: l.nome, cidade: l.cidade, pontuacao: l.pontuacao, servico: l.servicoRecomendado })),
    pendencias: novos.flatMap((l) => (l.pendencias || []).map((p) => `${l.nome}: ${p}`)).slice(0, 12),
    falhas,
    leadIds: novos.map((l) => l.id),
    recado: novos.length === 0
      ? 'Nenhuma oportunidade nova confiável hoje. Prefiro não entregar nome inventado.'
      : novos.length < cfg.metaDiaria
        ? `Encontrei ${novos.length} de ${cfg.metaDiaria}. O resto não tinha contato público ou fonte que sustentasse.`
        : `Meta do dia cumprida: ${novos.length} oportunidades novas.`,
  }
  await gravar('prospect_relatorios', [relatorio], cabecalhos, userId)
  return { relatorio, novos, atualizados }
}

export default async function handler(req, res) {
  if (!autorizado(req)) return res.status(401).json({ erro: 'Rotina protegida.' })
  try {
    const cabecalhos = auth()
    const cfg = await lerConfig(cabecalhos)
    const userId = await donoDoSistema(cabecalhos)
    const { relatorio } = await rodarRotina({ cabecalhos, cfg, userId })
    return res.status(200).json({ ok: true, ...relatorio })
  } catch (e) {
    console.error('prospect/rotina', e)
    return res.status(500).json({ ok: false, erro: String(e.message || e) })
  }
}
