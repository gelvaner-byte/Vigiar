import { useMemo, useState } from 'react'
import { Plus, Trash2, Receipt } from 'lucide-react'
import StatusBadge from './StatusBadge'
import FilterBar from './FilterBar'
import { CATEGORIAS_DESPESA_FIXA } from '../data/categories'
import { formatBRL, formatDateBR, isSameMonth, isOverdue, todayISO } from '../utils/format'

const emptyForm = {
  descricao: '',
  categoria: CATEGORIAS_DESPESA_FIXA[0],
  valor: '',
  vencimento: todayISO(),
}

export default function DespesasFixas({ items, addItem, removeItem, toggleStatus }) {
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState('todos')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.descricao || !form.valor || !form.vencimento) return
    addItem({ ...form, valor: Number(form.valor), status: 'pendente' })
    setForm(emptyForm)
  }

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.descricao.toLowerCase().includes(search.toLowerCase()) ||
        it.categoria.toLowerCase().includes(search.toLowerCase())
      const matchesMonth = !month || it.vencimento?.startsWith(month)
      const matchesStatus = status === 'todos' || it.status === status
      return matchesSearch && matchesMonth && matchesStatus
    })
  }, [items, search, month, status])

  const totalPendente = filtered
    .filter((it) => it.status === 'pendente')
    .reduce((acc, it) => acc + Number(it.valor), 0)

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          type="text"
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500 lg:col-span-2"
          required
        />
        <select
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        >
          {CATEGORIAS_DESPESA_FIXA.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor (R$)"
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
          required
        />
        <input
          type="date"
          value={form.vencimento}
          onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
          required
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 lg:col-span-5"
        >
          <Plus size={16} /> Adicionar Despesa Fixa
        </button>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-300">
            <Receipt size={18} />
            <h2 className="font-semibold">Despesas Fixas</h2>
          </div>
          <span className="text-sm text-slate-400">
            Total pendente (filtro atual): <span className="font-semibold text-red-400">{formatBRL(totalPendente)}</span>
          </span>
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          month={month}
          onMonthChange={setMonth}
          status={status}
          onStatusChange={setStatus}
          statusOptions={[
            { value: 'pago', label: 'Pago' },
            { value: 'pendente', label: 'Pendente' },
          ]}
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Descrição</th>
                <th className="pb-2">Categoria</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">Vencimento</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Nenhuma despesa fixa cadastrada.
                  </td>
                </tr>
              )}
              {filtered.map((it) => (
                <tr
                  key={it.id}
                  className={`border-t border-slate-800/80 ${
                    it.status === 'pago'
                      ? 'bg-emerald-500/5'
                      : isOverdue(it.vencimento)
                        ? 'bg-red-500/10'
                        : 'bg-red-500/5'
                  }`}
                >
                  <td className="py-3 pr-2 text-slate-200">{it.descricao}</td>
                  <td className="py-3 pr-2 text-slate-400">{it.categoria}</td>
                  <td className="py-3 pr-2 font-medium text-slate-200">{formatBRL(it.valor)}</td>
                  <td className="py-3 pr-2 text-slate-400">
                    {formatDateBR(it.vencimento)}
                    {it.status === 'pendente' && isOverdue(it.vencimento) && (
                      <span className="ml-2 text-xs font-medium text-red-400">Atrasado</span>
                    )}
                  </td>
                  <td className="py-3 pr-2">
                    <StatusBadge status={it.status} onClick={() => toggleStatus(it.id, 'pago', 'pendente')} />
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => removeItem(it.id)}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
