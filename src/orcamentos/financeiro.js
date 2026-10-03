import { supabase } from './supabaseOrc'

// Lê o que o app de Gestão Financeira guarda no mesmo banco.
// Só o dono enxerga: as tabelas são protegidas por "cada login vê as próprias linhas".

const TABELAS = ['despesas_fixas', 'custos_mercadorias', 'debitos_receber', 'estoque']

export async function carregarFinanceiro() {
  const [despesas, custos, receber, estoque] = await Promise.all(
    TABELAS.map(async (t) => {
      const { data, error } = await supabase.from(t).select('*')
      if (error) {
        console.error('financeiro:' + t, error)
        return []
      }
      return data || []
    }),
  )
  return { despesas, custos, receber, estoque }
}

const num = (v) => Number(v) || 0

// Resumo enxuto para o agente: números prontos + as linhas que exigem ação.
export function resumoFinanceiro(f, hoje = new Date().toISOString().slice(0, 10)) {
  if (!f) return null
  const mes = hoje.slice(0, 7)
  const pendente = (x) => String(x.status || '').toLowerCase() !== 'pago' && String(x.status || '').toLowerCase() !== 'recebido'

  const despesasMes = f.despesas.filter((d) => String(d.vencimento || '').startsWith(mes))
  const custosMes = f.custos.filter((c) => String(c.vencimento || '').startsWith(mes))
  const aPagar = [...f.despesas, ...f.custos].filter(pendente)
  const vencidas = aPagar.filter((x) => x.vencimento && x.vencimento < hoje)
  const aReceber = f.receber.filter(pendente)
  const receberVencido = aReceber.filter((x) => x.vencimento && x.vencimento < hoje)

  const soma = (lista, campo = 'valor') => lista.reduce((s, x) => s + num(x[campo] ?? x.valorParcela ?? x.valor_parcela), 0)

  return {
    mes,
    despesasFixasDoMes: soma(despesasMes),
    custosMercadoriasDoMes: soma(custosMes),
    totalAPagar: soma(aPagar),
    contasVencidas: vencidas.map((x) => ({
      descricao: x.descricao || x.fornecedor, valor: num(x.valor), vencimento: x.vencimento,
    })),
    totalAReceber: aReceber.reduce((s, x) => s + num(x.valor_parcela ?? x.valorParcela ?? x.valor_total ?? x.valor), 0),
    inadimplentes: receberVencido.map((x) => ({
      cliente: x.cliente, descricao: x.descricao, valor: num(x.valor_parcela ?? x.valorParcela ?? x.valor_total),
      vencimento: x.vencimento,
    })),
    valorEmEstoque: f.estoque.reduce((s, x) => s + num(x.valor_total ?? x.valorTotal ?? (num(x.quantidade) * num(x.valor_unitario ?? x.valorUnitario))), 0),
    itensEmEstoque: f.estoque.length,
  }
}
