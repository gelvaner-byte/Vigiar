// Liga e desliga a prospecção. Pausada, a rotina das 10h não procura nada e não gasta busca.
import { auth, lerConfig } from './_lib.js'
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

  const pausar = req.body?.pausar !== false
  const motivo = String(req.body?.motivo || '').slice(0, 300)

  try {
    const cabecalhos = auth({ jwt })
    const cfg = await lerConfig(cabecalhos)
    const novo = {
      ...cfg,
      pausado: pausar,
      pausadoEm: pausar ? new Date().toISOString() : null,
      pausadoPor: pausar ? dono.email : '',
      motivoPausa: pausar ? motivo : '',
    }
    const r = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/orc_registros?on_conflict=colecao,id`, {
      method: 'POST',
      headers: { ...cabecalhos, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        user_id: dono.id, colecao: 'config', id: 'prospect', dados: novo,
        excluido: false, atualizado_em: new Date().toISOString(),
      }]),
    })
    if (!r.ok) throw new Error(await r.text())
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
