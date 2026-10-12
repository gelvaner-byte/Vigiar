// Escrita no Mercado Livre: preço, estoque, título, pausar/ativar e responder pergunta.
// Nada aqui roda sozinho — o app só chama depois que o Gelvan confirma na tela.
// Mesmo assim, as travas abaixo valem no SERVIDOR: se o modelo errar, o pedido é recusado aqui.
import { COLECAO, jwtDaRequisicao, lerConexao, ml, tokenValido, usuarioDoToken } from './_lib.js'

const num = (v) => Number(v) || 0
const TAXA_PADRAO = 0.14               // comissão média do Mercado Livre, igual à do painel
const VARIACAO_MAX = 0.4               // mexer mais de 40% no preço exige confirmação reforçada
const ESTOQUE_MAX = 9999

// Lê os custos de compra que o Gelvan cadastrou no app, para não deixar vender no prejuízo.
async function custoDoItem(jwt, itemId) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  try {
    const r = await fetch(
      `${url}/rest/v1/orc_registros?colecao=eq.ml_custos&id=eq.${encodeURIComponent(itemId)}&select=dados`,
      { headers: { apikey: key, Authorization: `Bearer ${jwt}` } },
    )
    if (!r.ok) return null
    const linhas = await r.json()
    return linhas?.[0]?.dados || null
  } catch {
    return null
  }
}

// Quanto sobra no bolso vendendo por esse preço, já tirando comissão, imposto e custos.
function liquido(preco, custo) {
  const taxa = custo?.taxa != null ? num(custo.taxa) / 100 : TAXA_PADRAO
  const imposto = num(custo?.imposto) / 100
  const saida = num(custo?.compra) + num(custo?.frete) + num(custo?.extra)
  return preco - preco * taxa - preco * imposto - saida
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' })

  const jwt = jwtDaRequisicao(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono para alterar o Mercado Livre.' })

  const { acao, itemId, valor, texto, perguntaId, forcar = false } = req.body || {}
  if (!acao) return res.status(400).json({ erro: 'Diga qual alteração fazer.' })

  try {
    const conexao = await lerConexao(jwt)
    if (!conexao?.access) return res.status(409).json({ erro: 'A conta do Mercado Livre não está conectada.' })

    const valido = await tokenValido(jwt, dono.id)
    if (!valido) return res.status(409).json({ erro: 'A autorização do Mercado Livre expirou. Conecte a conta de novo.' })
    const { token } = valido

    /* ===== responder pergunta ===== */
    if (acao === 'responder_pergunta') {
      const resposta = String(texto || '').trim()
      if (!perguntaId) return res.status(400).json({ erro: 'Falta dizer qual pergunta.' })
      if (resposta.length < 2) return res.status(400).json({ erro: 'A resposta está vazia.' })
      if (resposta.length > 2000) return res.status(400).json({ erro: 'A resposta passa de 2000 caracteres.' })
      await ml('/answers', token, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question_id: perguntaId, text: resposta }),
      })
      return res.status(200).json({ ok: true, acao, mensagem: 'Pergunta respondida no Mercado Livre.' })
    }

    /* ===== daqui para baixo, tudo mexe num anúncio ===== */
    if (!itemId) return res.status(400).json({ erro: 'Falta dizer qual anúncio.' })

    const item = await ml(`/items/${itemId}?attributes=id,title,price,available_quantity,status,seller_id`, token)
    // Trava dura: só mexe em anúncio da conta conectada.
    if (String(item.seller_id) !== String(conexao.mlUserId)) {
      return res.status(403).json({ erro: 'Esse anúncio não é da sua conta. Nada foi alterado.' })
    }
    const antes = {
      titulo: item.title, preco: num(item.price),
      estoque: num(item.available_quantity), situacao: item.status,
    }

    let corpo = null
    let resumo = ''

    if (acao === 'preco') {
      const novo = num(valor)
      if (novo <= 0) return res.status(400).json({ erro: 'Preço precisa ser maior que zero.' })

      const variacao = antes.preco ? Math.abs(novo - antes.preco) / antes.preco : 0
      if (variacao > VARIACAO_MAX && !forcar) {
        return res.status(409).json({
          erro: `Mudança de ${(variacao * 100).toFixed(0)}% no preço (de ${antes.preco} para ${novo}). ` +
            'Por segurança eu não aplico de primeira: confirme de novo dizendo que é isso mesmo.',
          precisaForcar: true, antes,
        })
      }

      const custo = await custoDoItem(jwt, itemId)
      if (custo?.compra) {
        const sobra = liquido(novo, custo)
        if (sobra <= 0 && !forcar) {
          return res.status(409).json({
            erro: `Com custo de ${num(custo.compra)} reais, vender a ${novo} dá prejuízo de ` +
              `${Math.abs(sobra).toFixed(2)} reais por unidade. Não apliquei.`,
            precisaForcar: true, antes,
          })
        }
      }
      corpo = { price: novo }
      resumo = `Preço de ${antes.preco} para ${novo}.`

    } else if (acao === 'estoque') {
      const novo = Math.trunc(num(valor))
      if (novo < 0 || novo > ESTOQUE_MAX) return res.status(400).json({ erro: `Estoque precisa ser de 0 a ${ESTOQUE_MAX}.` })
      corpo = { available_quantity: novo }
      resumo = `Estoque de ${antes.estoque} para ${novo}.`

    } else if (acao === 'titulo') {
      const novo = String(texto || '').trim()
      if (novo.length < 10) return res.status(400).json({ erro: 'Título curto demais (mínimo 10 caracteres).' })
      if (novo.length > 60) return res.status(400).json({ erro: 'O Mercado Livre aceita no máximo 60 caracteres no título.' })
      corpo = { title: novo }
      resumo = `Título trocado para: ${novo}`

    } else if (acao === 'pausar' || acao === 'ativar') {
      const destino = acao === 'pausar' ? 'paused' : 'active'
      if (antes.situacao === destino) {
        return res.status(200).json({ ok: true, acao, semMudanca: true, antes, mensagem: `O anúncio já está ${acao === 'pausar' ? 'pausado' : 'ativo'}.` })
      }
      if (destino === 'active' && antes.estoque < 1) {
        return res.status(409).json({ erro: 'Não dá para ativar com estoque zero. Ajuste o estoque primeiro.', antes })
      }
      corpo = { status: destino }
      resumo = acao === 'pausar' ? 'Anúncio pausado.' : 'Anúncio ativado.'

    } else {
      return res.status(400).json({ erro: `Não sei fazer "${acao}".` })
    }

    const depois = await ml(`/items/${itemId}`, token, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    })

    return res.status(200).json({
      ok: true, acao, itemId, antes, resumo,
      depois: {
        titulo: depois.title, preco: num(depois.price),
        estoque: num(depois.available_quantity), situacao: depois.status,
      },
      mensagem: `${antes.titulo} — ${resumo}`,
    })
  } catch (e) {
    console.error('ml/alterar', e)
    const msg = String(e.message || e)
    // 403 do ML quase sempre é permissão de escrita que falta no app do DevCenter.
    if (/403|forbidden|unauthorized_scope|invalid_scope/i.test(msg)) {
      return res.status(403).json({
        erro: 'O Mercado Livre recusou por falta de permissão de escrita. No DevCenter, coloque ' +
          '"Publicação e sincronização" em Leitura e escrita e conecte a conta de novo.',
      })
    }
    return res.status(502).json({ erro: msg })
  }
}

export { COLECAO }
