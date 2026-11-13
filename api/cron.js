// Agendador único da manhã. O plano só permite poucos horários marcados, então as duas
// rotinas automáticas saem daqui, em sequência: primeiro o post do Instagram (é o que tem
// hora marcada para o Gelvan: 10h), depois a prospecção.
// Roda no servidor: não precisa de ninguém logado nem de navegador aberto.
import { auth, donoDoSistema, lerConfig } from './prospect/_lib.js'
import { rodarRotina } from './prospect/_rotina.js'
import { gerarEntrega } from './marketing.js'

const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// Só a Vercel dispara isto. Com CRON_SECRET configurado, exige o segredo.
function autorizado(req) {
  const segredo = process.env.CRON_SECRET
  if (segredo && (req.headers.authorization || '') === `Bearer ${segredo}`) return true
  const daVercel = req.headers['x-vercel-cron'] || /vercel-cron/i.test(req.headers['user-agent'] || '')
  return !segredo && !!daVercel
}

export default async function handler(req, res) {
  if (!autorizado(req)) return res.status(401).json({ erro: 'Rotina protegida.' })

  const saida = { data: hojeBR(), marketing: null, prospeccao: null }
  let cabecalhos
  let userId
  try {
    cabecalhos = auth()
    userId = await donoDoSistema(cabecalhos)
  } catch (e) {
    return res.status(500).json({ erro: String(e.message || e) })
  }

  // Marketing primeiro: tem hora marcada na tela. Se falhar, a prospecção ainda roda.
  try {
    const r = await gerarEntrega({ cabecalhos, userId, data: hojeBR() })
    saida.marketing = r.jaExistia
      ? { ok: true, jaExistia: true }
      : { ok: !!r.entrega.ok, erro: r.entrega.erro || null, titulo: r.entrega.titulo || null };
  } catch (e) {
    saida.marketing = { ok: false, erro: String(e.message || e) }
  }

  try {
    const cfg = await lerConfig(cabecalhos)
    const r = await rodarRotina({ cabecalhos, cfg, userId })
    saida.prospeccao = { ok: true, novos: r.relatorio.novos, recado: r.relatorio.recado }
  } catch (e) {
    saida.prospeccao = { ok: false, erro: String(e.message || e) }
  }

  return res.status(200).json(saida)
}
