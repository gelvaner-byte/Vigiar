// Lê os dados reais da conta conectada: anúncios, vendas, reputação e perguntas.
// Só leitura. Nada aqui altera anúncio, preço ou estoque.
import { jwtDaRequisicao, lerConexao, ml, tokenValido, usuarioDoToken } from './_lib.js'

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString()
const num = (v) => Number(v) || 0

// A API devolve no máximo 20 itens por consulta de detalhe.
async function detalhesDosItens(ids, token) {
  const saida = []
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20).join(',')
    const r = await ml(`/items?ids=${lote}&attributes=id,title,price,available_quantity,sold_quantity,status,permalink,thumbnail,listing_type_id,health,catalog_listing`, token)
    r.forEach((x) => { if (x.code === 200 && x.body) saida.push(x.body) })
  }
  return saida
}

async function buscarIds(mlUserId, token, status) {
  const ids = []
  let offset = 0
  // teto de 200 por situação: suficiente para o painel e segura o consumo da API
  while (offset < 200) {
    const r = await ml(`/users/${mlUserId}/items/search?status=${status}&limit=50&offset=${offset}`, token)
    ids.push(...(r.results || []))
    const total = r.paging?.total ?? ids.length
    offset += 50
    if (ids.length >= total || !(r.results || []).length) break
  }
  return ids
}

export default async function handler(req, res) {
  const jwt = jwtDaRequisicao(req)
  const dono = jwt ? await usuarioDoToken(jwt) : null
  if (!dono) return res.status(401).json({ erro: 'Entre com a conta do dono.' })

  if (!process.env.ML_CLIENT_ID) {
    return res.status(200).json({ conectado: false, configurado: false })
  }

  try {
    const conexao = await lerConexao(jwt)
    if (!conexao?.access) return res.status(200).json({ conectado: false, configurado: true })

    const valido = await tokenValido(jwt, dono.id)
    if (!valido) {
      return res.status(200).json({
        conectado: false, configurado: true,
        erro: 'A autorização do Mercado Livre expirou. Conecte a conta de novo.',
      })
    }
    const { token } = valido
    const mlUserId = conexao.mlUserId

    const [eu, idsAtivos, idsPausados, vendas30, perguntas] = await Promise.all([
      ml('/users/me', token),
      buscarIds(mlUserId, token, 'active'),
      buscarIds(mlUserId, token, 'paused'),
      ml(`/orders/search?seller=${mlUserId}&order.date_created.from=${diasAtras(30)}&sort=date_desc&limit=50`, token),
      ml('/my/received_questions/search?status=UNANSWERED&limit=20', token).catch(() => ({ questions: [] })),
    ])

    const itens = await detalhesDosItens([...idsAtivos, ...idsPausados], token)
    const pedidos = (vendas30.results || []).filter((p) => p.status === 'paid' || p.status === 'confirmed')

    const faturado30 = pedidos.reduce((s, p) => s + num(p.total_amount), 0)
    const porProduto = {}
    pedidos.forEach((p) => {
      (p.order_items || []).forEach((it) => {
        const id = it.item?.id
        if (!id) return
        porProduto[id] = porProduto[id] || { id, titulo: it.item?.title, unidades: 0, valor: 0 }
        porProduto[id].unidades += num(it.quantity)
        porProduto[id].valor += num(it.quantity) * num(it.unit_price)
      })
    })

    const rep = eu.seller_reputation || {}
    return res.status(200).json({
      conectado: true,
      configurado: true,
      conta: { id: eu.id, apelido: eu.nickname, site: eu.site_id, conectadoEm: conexao.conectadoEm },
      reputacao: {
        nivel: rep.level_id || null,
        status: rep.power_seller_status || null,
        vendasTotais: rep.transactions?.total ?? null,
        canceladas: rep.transactions?.canceled ?? null,
        reclamacoes: rep.metrics?.claims?.rate ?? null,
        atrasos: rep.metrics?.delayed_handling_time?.rate ?? null,
      },
      anuncios: {
        ativos: idsAtivos.length,
        pausados: idsPausados.length,
        lista: itens.map((i) => ({
          id: i.id, titulo: i.title, preco: num(i.price), estoque: num(i.available_quantity),
          vendidos: num(i.sold_quantity), situacao: i.status, tipo: i.listing_type_id,
          qualidade: i.health ?? null, link: i.permalink, foto: i.thumbnail,
        })),
      },
      vendas30dias: {
        pedidos: pedidos.length,
        faturado: faturado30,
        ticketMedio: pedidos.length ? faturado30 / pedidos.length : 0,
        maisVendidos: Object.values(porProduto).sort((a, b) => b.valor - a.valor).slice(0, 10),
        recentes: pedidos.slice(0, 8).map((p) => ({
          id: p.id, data: p.date_created, valor: num(p.total_amount), status: p.status,
          itens: (p.order_items || []).map((i) => `${i.quantity}x ${i.item?.title}`),
        })),
      },
      perguntasSemResposta: (perguntas.questions || []).length,
      lidoEm: new Date().toISOString(),
    })
  } catch (e) {
    console.error('ml/dados', e)
    return res.status(502).json({ conectado: true, configurado: true, erro: String(e.message || e) })
  }
}
