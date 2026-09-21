import { useMemo, useState } from 'react'
import { Plus, Trash2, Package, AlertCircle } from 'lucide-react'
import StatusBadge from './StatusBadge'
import FilterBar from './FilterBar'
import { formatBRL, formatDateBR, isOverdue, matchesMonthFilter, todayISO } from '../utils/format'

const emptyForm = {
  fornecedor: '',
  descricao: '',
  valor: '',
  vencimento: todayISO(),
}

export default function CustosMercadorias({ items, addItem, removeItem, toggleStatus }) {
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState('todos')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.fornecedor || !form.descricao || !form.valor || !form.vencimento) return
    addItem({ ...form, valor: Number(form.valor), status: 'pendente' })
    setForm(emptyForm)
  }

  const totalDevido = items
    .filter((it) => it.status === 'pendente')
    .reduce((acc, it) => acc + Number(it.valor), 0)

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.fornecedor.toLowerCase().includes(search.toLowerCase()) ||
        it.descricao.toLowerCase().includes(search.toLowerCase())
      const matchesMonth = matchesMonthFilter(it.vencimento, month)
      const matchesStatus = status === 'todos' || it.status === status
      return matchesSearch && matchesMonth && matchesStatus
    })
  }, [items, search, month, status])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-amber-500/15 p-2 text-amber-400">
            <AlertCircle size={20} />
          </span>
          <div>
            <p className="text-sm text-amber-300/80">Total Devido em Mercadorias (fornecedores pendentes)</p>
            <p className="text-2xl font-semibold text-amber-400">{formatBRL(totalDevido)}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          type="text"
          placeholder="Fornecedor"
          value={form.fornecedor}
          onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
          required
        />
        <input
          type="text"
          placeholder="Descrição do Lote/Produto (câmeras, DVR, cabos...)"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500 lg:col-span-2"
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor Total (R$)"
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
          <Plus size={16} /> Adicionar Lote/Fornecedor
        </button>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center gap-2 text-slate-300">
          <Package size={18} />
          <h2 className="font-semibold">Custos de Mercadorias</h2>
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          month={month}
          onMonthChange={setMonth}
          status={status}
          onStatusChange={setStatus}
          searchPlaceholder="Buscar por fornecedor ou produto..."
          statusOptions={[
            { value: 'pago', label: 'Pago' },
            { value: 'pendente', label: 'Pendente' },
          ]}
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Fornecedor</th>
                <th className="pb-2">Descrição</th>
                <th className="pb-2">Valor Total</th>
                <th className="pb-2">Vencimento</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Nenhum custo de mercadoria cadastrado.
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
                  <td className="py-3 pr-2 text-slate-200">{it.fornecedor}</td>
                  <td className="py-3 pr-2 text-slate-400">{it.descricao}</td>
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
