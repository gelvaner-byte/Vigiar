import { CheckCircle2, Clock } from 'lucide-react'

export default function StatusBadge({ status, onClick, positiveLabel = 'Pago', negativeLabel = 'Pendente', positiveValue = 'pago' }) {
  const isPositive = status === positiveValue
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clique para alternar status"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isPositive
          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
      }`}
    >
      {isPositive ? <CheckCircle2 size={14} /> : <Clock size={14} />}
      {isPositive ? positiveLabel : negativeLabel}
    </button>
  )
}
