import { Wallet, TrendingUp, TrendingDown, HeartPulse, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react'
import { formatBRL, isSameMonth, isOverdue } from '../utils/format'

function sumWhere(list, predicate, valueKey = 'valor') {
  return list.filter(predicate).reduce((acc, it) => acc + (Number(it[valueKey]) || 0), 0)
}

export default function Dashboard({ despesasFixas, custosMercadorias, debitosReceber }) {
  const totalPagoDespesas = sumWhere(despesasFixas, (it) => it.status === 'pago')
  const totalPagoMercadorias = sumWhere(custosMercadorias, (it) => it.status === 'pago')
  const totalRecebido = sumWhere(debitosReceber, (it) => it.status === 'recebido', 'valorTotal')

  const saldoTotal = totalRecebido - totalPagoDespesas - totalPagoMercadorias

  const entradasMes = sumWhere(debitosReceber, (it) => isSameMonth(it.vencimento), 'valorTotal')
  const despesasMes =
    sumWhere(despesasFixas, (it) => isSameMonth(it.vencimento)) +
    sumWhere(custosMercadorias, (it) => isSameMonth(it.vencimento))

  const overdueCount =
    despesasFixas.filter((it) => it.status === 'pendente' && isOverdue(it.vencimento)).length +
    custosMercadorias.filter((it) => it.status === 'pendente' && isOverdue(it.vencimento)).length +
    debitosReceber.filter((it) => it.status === 'pendente' && isOverdue(it.vencimento)).length

  let health = { label: 'Saudável', color: 'emerald', Icon: ShieldCheck }
  if (saldoTotal < 0) {
    health = { label: 'Crítico', color: 'red', Icon: ShieldAlert }
  } else if (overdueCount > 0) {
    health = { label: 'Atenção', color: 'amber', Icon: AlertTriangle }
  }

  const cards = [
    {
      label: 'Saldo Total Atual',
      value: formatBRL(saldoTotal),
      Icon: Wallet,
      tone: saldoTotal >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Entradas / A Receber no Mês',
      value: formatBRL(entradasMes),
      Icon: TrendingUp,
      tone: 'emerald',
    },
    {
      label: 'Despesas / A Pagar no Mês',
      value: formatBRL(despesasMes),
      Icon: TrendingDown,
      tone: 'orange',
    },
    {
      label: 'Saúde Financeira',
      value: health.label,
      Icon: health.Icon,
      tone: health.color,
      sub: overdueCount > 0 ? `${overdueCount} item(ns) vencido(s)` : 'Tudo em dia',
    },
  ]

  const toneClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{card.label}</span>
            <span className={`rounded-lg p-2 ${toneClasses[card.tone]}`}>
              <card.Icon size={18} />
            </span>
          </div>
          <p className={`mt-3 text-2xl font-semibold ${toneClasses[card.tone].split(' ')[0]}`}>{card.value}</p>
          {card.sub && <p className="mt-1 text-xs text-slate-500">{card.sub}</p>}
        </div>
      ))}
    </div>
  )
}
