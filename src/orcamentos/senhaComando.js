// Senha própria do Centro de Comando — separada da senha da conta.
// Guardamos só o "resumo" (hash) da senha, nunca a senha em si: nem eu, nem quem
// olhar o banco consegue ler qual é. A conferência é feita aqui no aparelho.

const ITERACOES = 150000

const paraHex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

export function novoSal() {
  const s = new Uint8Array(16)
  crypto.getRandomValues(s)
  return paraHex(s.buffer)
}

export async function resumo(senha, sal) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(sal), iterations: ITERACOES, hash: 'SHA-256' },
    base,
    256,
  )
  return paraHex(bits)
}

export async function conferir(senha, cfg) {
  if (!cfg || !cfg.sal || !cfg.hash) return false
  return (await resumo(senha, cfg.sal)) === cfg.hash
}

export async function montarConfig(senha) {
  const sal = novoSal()
  return { sal, hash: await resumo(senha, sal), atualizadoEm: new Date().toISOString() }
}
