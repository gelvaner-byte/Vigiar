import { Search } from 'lucide-react'
import { MESES, getAnoOptions, parseMonthFilter, combineMonthFilter } from '../utils/format'

const ANOS = getAnoOptions()

export default function FilterBar({
  search,
  onSearchChange,
  month,
  onMonthChange,
  status,
  onStatusChange,
  statusOptions,
  searchPlaceholder = 'Buscar por nome ou categoria...',
}) {
  const { mes, ano } = parseMonthFilter(month)

  function handleMesChange(novoMes) {
    onMonthChange(combineMonthFilter(novoMes, ano))
  }

  function handleAnoChange(novoAno) {
    onMonthChange(combineMonthFilter(mes, novoAno))
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-orange-500"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          value={mes}
          onChange={(e) => handleMesChange(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        >
          <option value="">Todos os meses</option>
          {MESES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={ano}
          onChange={(e) => handleAnoChange(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        >
          <option value="">Todos os anos</option>
          {ANOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        >
          <option value="todos">Todos os status</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
