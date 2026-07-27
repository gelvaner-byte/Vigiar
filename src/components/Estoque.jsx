import { useMemo, useState } from 'react'
import { Plus, Trash2, Boxes, Search, Layers } from 'lucide-react'
import { CATEGORIAS_ESTOQUE } from '../data/categories'
import { formatBRL } from '../utils/format'

const emptyForm = {
  item: '',
  categoria: CATEGORIAS_ESTOQUE[0],
  quantidade: 1,
  valorUnitario: '',
}

export default function Estoque({ items, addItem, removeItem }) {
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('todas')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.item || !form.valorUnitario) return
    const quantidade = Number(form.quantidade) || 1
    const valorUnitario = Number(form.valorUnitario)
    addItem({
      ...form,
      quantidade,
      valorUnitario,
      valorTotal: quantidade * valorUnitario,
    })
    setForm(emptyForm)
  }

  const valorTotalEstoque = items.reduce((acc, it) => acc + Number(it.valorTotal), 0)
  const totalItens = items.reduce((acc, it) => acc + Number(it.quantidade), 0)

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.item.toLowerCase().includes(search.toLowerCase()) ||
        it.categoria.toLowerCase().includes(search.toLowerCase())
      const matchesCategoria = categoria === 'todas' || it.categoria === categoria
      return matchesSearch && matchesCategoria
    })
  }, [items, search, categoria])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-cyan-500/15 p-2 text-cyan-400">
              <Boxes size={20} />
            </span>
            <div>
              <p className="text-sm text-cyan-300/80">Valor Total em Estoque</p>
              <p className="text-2xl font-semibold text-cyan-400">{formatBRL(valorTotalEstoque)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-slate-800 p-2 text-slate-300">
              <Layers size={20} />
            </span>
            <div>
              <p className="text-sm text-slate-400">Itens Cadastrados</p>
              <p className="text-2xl font-semibold text-slate-200">{totalItens} un.</p>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          type="text"
          placeholder="Item (ex: Câmera Intelbras 1080p)"
          value={form.item}
          onChange={(e) => setForm({ ...form, item: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500 lg:col-span-2"
          required
        />
        <select
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        >
          {CATEGORIAS_ESTOQUE.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          placeholder="Quantidade"
          value={form.quantidade}
          onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor Unitário (R$)"
          value={form.valorUnitario}
          onChange={(e) => setForm({ ...form, valorUnitario: e.target.value })}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
          required
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 lg:col-span-5"
        >
          <Plus size={16} /> Adicionar ao Estoque
        </button>
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center gap-2 text-slate-300">
          <Boxes size={18} />
          <h2 className="font-semibold">Estoque</h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por item ou categoria..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-orange-500"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-500"
          >
            <option value="todas">Todas as categorias</option>
            {CATEGORIAS_ESTOQUE.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Item</th>
                <th className="pb-2">Categoria</th>
                <th className="pb-2">Qtd.</th>
                <th className="pb-2">Valor Unitário</th>
                <th className="pb-2">Valor Total</th>
                <th className="pb-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Nenhum item de estoque cadastrado.
                  </td>
                </tr>
              )}
              {filtered.map((it) => (
                <tr key={it.id} className="border-t border-slate-800/80">
                  <td className="py-3 pr-2 text-slate-200">{it.item}</td>
                  <td className="py-3 pr-2 text-slate-400">{it.categoria}</td>
                  <td className="py-3 pr-2 text-slate-400">{it.quantidade}</td>
                  <td className="py-3 pr-2 text-slate-400">{formatBRL(it.valorUnitario)}</td>
                  <td className="py-3 pr-2 font-medium text-slate-200">{formatBRL(it.valorTotal)}</td>
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
