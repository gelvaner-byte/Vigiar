import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { rowToItem, itemToRow } from './dbCase'

export function useSupabaseList(table) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const fetchItems = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    if (!error && data) setItems(data.map(rowToItem))
    setLoading(false)
  }, [table])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchItems()

    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchItems())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, fetchItems])

  async function addItem(item) {
    const { data, error } = await supabase.from(table).insert(itemToRow(item)).select().single()
    if (!error && data) setItems((prev) => [rowToItem(data), ...prev])
  }

  async function updateItem(id, patch) {
    const { data, error } = await supabase.from(table).update(itemToRow(patch)).eq('id', id).select().single()
    if (!error && data) setItems((prev) => prev.map((it) => (it.id === id ? rowToItem(data) : it)))
  }

  async function removeItem(id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id))
  }

  async function toggleStatus(id, onStatus, offStatus) {
    const current = items.find((it) => it.id === id)
    if (!current) return
    await updateItem(id, { status: current.status === onStatus ? offStatus : onStatus })
  }

  return { items, loading, addItem, updateItem, removeItem, toggleStatus }
}

export const TABLES = {
  despesasFixas: 'despesas_fixas',
  custosMercadorias: 'custos_mercadorias',
  debitosReceber: 'debitos_receber',
  estoque: 'estoque',
}
