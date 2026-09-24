import { supabase } from './supabaseOrc'

const TABELA = 'orc_registros'
const CACHE = 'vigiar:orc:cache:v1'

async function userId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Sessão expirada. Entre de novo.')
  return id
}

// Cópia local de segurança: guarda o último estado conhecido no próprio aparelho.
export function lerCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || 'null')
  } catch {
    return null
  }
}
export function gravarCache(estado) {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ ...lerCache(), ...estado, salvoEm: new Date().toISOString() }))
  } catch {
    /* sem espaço ou bloqueado: ignora, o banco é a fonte principal */
  }
}

export async function carregarTudo() {
  const { data, error } = await supabase
    .from(TABELA)
    .select('colecao, id, dados')
    .eq('excluido', false)
  if (error) throw error
  const out = { orcamentos: [], ordens: [], clientes: [], config: {} }
  for (const r of data || []) {
    if (r.colecao === 'config') out.config[r.id] = r.dados
    else if (out[r.colecao]) out[r.colecao].push(r.dados)
  }
  return out
}

export async function salvarRegistros(colecao, itens) {
  if (!itens.length) return
  const uid = await userId()
  const agora = new Date().toISOString()
  const rows = itens.map((it) => ({
    user_id: uid,
    colecao,
    id: String(it.id),
    dados: it,
    excluido: false,
    atualizado_em: agora,
  }))
  const { error } = await supabase.from(TABELA).upsert(rows, { onConflict: 'user_id,colecao,id' })
  if (error) throw error
}

export async function excluirRegistros(colecao, ids) {
  if (!ids.length) return
  const { error } = await supabase
    .from(TABELA)
    .update({ excluido: true, atualizado_em: new Date().toISOString() })
    .eq('colecao', colecao)
    .in('id', ids.map(String))
  if (error) throw error
}

export async function salvarConfig(chave, dados) {
  const uid = await userId()
  const { error } = await supabase
    .from(TABELA)
    .upsert(
      { user_id: uid, colecao: 'config', id: chave, dados, excluido: false, atualizado_em: new Date().toISOString() },
      { onConflict: 'user_id,colecao,id' },
    )
  if (error) throw error
}

// Salva só o que mudou entre a lista anterior e a nova.
export async function sincronizarLista(colecao, antes, depois) {
  const mapaAntes = new Map(antes.map((x) => [x.id, JSON.stringify(x)]))
  const idsDepois = new Set(depois.map((x) => x.id))
  const mudados = depois.filter((x) => mapaAntes.get(x.id) !== JSON.stringify(x))
  const removidos = antes.filter((x) => !idsDepois.has(x.id)).map((x) => x.id)
  await salvarRegistros(colecao, mudados)
  await excluirRegistros(colecao, removidos)
}

export function assinarMudancas(aoMudar) {
  const canal = supabase
    .channel('orc_registros-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABELA }, () => aoMudar())
    .subscribe()
  return () => supabase.removeChannel(canal)
}
