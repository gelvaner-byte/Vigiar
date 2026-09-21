import { useMemo, useState } from 'react'
import { Plus, Trash2, HandCoins } from 'lucide-react'
import StatusBadge from './StatusBadge'
import FilterBar from './FilterBar'
import { CATEGORIAS_DEBITO_RECEBER } from '../data/categories'
import { formatBRL, formatDateBR, isOverdue, matchesMonthFilter, todayISO } from '../utils/format'

const emptyForm = {
  categoria: CATEGORIAS_DEBITO_RECEBER[0],
  cliente: '',
  descricao: '',
  valorTotal: '',
  numParcelas: 1,
  valorParcela: '',
  vencimento: todayISO(),
}

export default function DebitosReceber({ items, addItem, removeItem, toggleStatus }) {
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState('todos')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.cliente || !form.descricao || !form.valorTotal || !form.vencimento) return
    const numParcelas = Number(form.numParcelas) || 1
    const valorParcela = form.valorParcela
      ? Number(form.valorParcela)
      : Number(form.valorTotal) / numParcelas
    addItem({
      ...form,
      valorTotal: Number(form.valorTotal),
      numParcelas,
      valorParcela,
      status: 'pendente',
    })
    setForm(emptyForm)
  }

  const totalReceber = items
    .filter((it) => it.status === 'pendente')
    .reduce((acc, it) => acc + Number(it.valorTotal), 0)

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.cliente.toLowerCase().includes(search.toLowerCase()) ||
        it.categoria.toLowerCase().includes(search.toLowerCase())
      const matchesMonth = matchesMonthFilter(it.vencimento, month)
      const matchesStatus = status === 'todos' || it.status === status
      return matchesSearch && matchesMonth && matchesStatus
    })
  }, [items, search, month, status])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
            <HandCoins size={20} />
          </span>
          <div>
            <p className="text-sm text-emerald-300/80">Total a Receber (pendentes)</p>
            <p className="text-2xl font-semibold text-emerald-400">{formatBRL(totalReceber)}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <select
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500 lg:col-span-2"
        >
          {CATEGORIAS_DEBITO_RECEBER.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Nome do Cliente/Devedor"
          value={form.cliente}
          onChange={(e) => setForm({ ...form, cliente: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500 lg:col-span-2"
          required
        />
        <input
          type="text"
          placeholder="Descrição"
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
          value={form.valorTotal}
          onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
          required
        />
        <input
          type="number"
          min="1"
          placeholder="Nº de Parcelas"
          value={form.numParcelas}
          onChange={(e) => setForm({ ...form, numParcelas: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor da Parcela (auto se vazio)"
          value={form.valorParcela}
          onChange={(e) => setForm({ ...form, valorParcela: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
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
          className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 lg:col-span-6"
        >
          <Plus size={16} /> Adicionar Débito a Receber
        </button>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center gap-2 text-slate-300">
          <HandCoins size={18} />
          <h2 className="font-semibold">Débitos a Receber</h2>
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          month={month}
          onMonthChange={setMonth}
          status={status}
          onStatusChange={setStatus}
          searchPlaceholder="Buscar por cliente ou categoria..."
          statusOptions={[
            { value: 'recebido', label: 'Recebido' },
            { value: 'pendente', label: 'Pendente' },
          ]}
        />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Cliente/Devedor</th>
                <th className="pb-2">Categoria</th>
                <th className="pb-2">Descrição</th>
                <th className="pb-2">Valor Total</th>
                <th className="pb-2">Parcelas</th>
                <th className="pb-2">Vencimento</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Nenhum débito a receber cadastrado.
                  </td>
                </tr>
              )}
              {filtered.map((it) => (
                <tr
                  key={it.id}
                  className={`border-t border-slate-800/80 ${
                    it.status === 'recebido'
                      ? 'bg-emerald-500/5'
                      : isOverdue(it.vencimento)
                        ? 'bg-red-500/10'
                        : 'bg-red-500/5'
                  }`}
                >
                  <td className="py-3 pr-2 text-slate-200">{it.cliente}</td>
                  <td className="py-3 pr-2 text-slate-400">{it.categoria}</td>
                  <td className="py-3 pr-2 text-slate-400">{it.descricao}</td>
                  <td className="py-3 pr-2 font-medium text-slate-200">{formatBRL(it.valorTotal)}</td>
                  <td className="py-3 pr-2 text-slate-400">
                    {it.numParcelas}x de {formatBRL(it.valorParcela)}
                  </td>
                  <td className="py-3 pr-2 text-slate-400">
                    {formatDateBR(it.vencimento)}
                    {it.status === 'pendente' && isOverdue(it.vencimento) && (
                      <span className="ml-2 text-xs font-medium text-red-400">Atrasado</span>
                    )}
                  </td>
                  <td className="py-3 pr-2">
                    <StatusBadge
                      status={it.status}
                      onClick={() => toggleStatus(it.id, 'recebido', 'pendente')}
                      positiveLabel="Recebido"
                      negativeLabel="Pendente"
                      positiveValue="recebido"
                    />
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
