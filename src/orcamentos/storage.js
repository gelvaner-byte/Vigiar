import { supabase } from './supabaseOrc'

const TABELA = 'orc_registros'
const CACHE = 'vigiar:orc:cache:v1'

async function userId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) {
    await pedirLoginDeNovo()
    throw new Error('Sessão expirada. Entre de novo.')
  }
  return id
}

// Token vencido ou inválido: em vez de "não salvou", o app volta para a tela de login.
function ehErroDeSessao(erro) {
  const txt = `${erro?.message || ''} ${erro?.code || ''}`.toLowerCase()
  return erro?.status === 401 || erro?.status === 403 ||
    txt.includes('jwt') || txt.includes('token') || txt.includes('not authenticated')
}
async function pedirLoginDeNovo() {
  try { await supabase.auth.signOut() } catch { /* já estava fora */ }
}
async function conferir(erro) {
  if (!erro) return
  if (ehErroDeSessao(erro)) {
    await pedirLoginDeNovo()
    throw new Error('Sua sessão expirou. Entre de novo para continuar salvando.')
  }
  throw erro
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
  if (error) await conferir(error)
  // Se o mesmo registro vier em duplicidade (cópias antigas de antes da chave única),
  // fica só uma — senão o app tentaria gravar o mesmo id duas vezes no mesmo comando.
  const out = { orcamentos: [], ordens: [], clientes: [], config: {} }
  const vistos = { orcamentos: new Set(), ordens: new Set(), clientes: new Set() }
  for (const r of data || []) {
    if (r.colecao === 'config') { out.config[r.id] = r.dados; continue }
    if (!out[r.colecao] || vistos[r.colecao].has(r.id)) continue
    vistos[r.colecao].add(r.id)
    out[r.colecao].push(r.dados)
  }
  return out
}

export async function salvarRegistros(colecao, itens) {
  if (!itens.length) return
  const uid = await userId()
  const agora = new Date().toISOString()
  // Um id só pode aparecer uma vez no mesmo comando.
  const unicos = [...new Map(itens.map((it) => [String(it.id), it])).values()]
  const rows = unicos.map((it) => ({
    user_id: uid,
    colecao,
    id: String(it.id),
    dados: it,
    excluido: false,
    atualizado_em: agora,
  }))
  // A chave é o registro (colecao + id): qualquer pessoa da equipe altera a mesma linha.
  const { error } = await supabase.from(TABELA).upsert(rows, { onConflict: 'colecao,id' })
  if (error) await conferir(error)
}

export async function excluirRegistros(colecao, ids) {
  if (!ids.length) return
  const { error } = await supabase
    .from(TABELA)
    .update({ excluido: true, atualizado_em: new Date().toISOString() })
    .eq('colecao', colecao)
    .in('id', ids.map(String))
  if (error) await conferir(error)
}

export async function salvarConfig(chave, dados) {
  const uid = await userId()
  const { error } = await supabase
    .from(TABELA)
    .upsert(
      { user_id: uid, colecao: 'config', id: chave, dados, excluido: false, atualizado_em: new Date().toISOString() },
      { onConflict: 'colecao,id' },
    )
  if (error) await conferir(error)
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
