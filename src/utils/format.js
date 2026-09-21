export function formatBRL(value) {
  const n = Number(value) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDateBR(isoDate) {
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

export function isSameMonth(isoDate, refDate = new Date()) {
  if (!isoDate) return false
  const [year, month] = isoDate.split('-').map(Number)
  return year === refDate.getFullYear() && month === refDate.getMonth() + 1
}

export function isOverdue(isoDate) {
  if (!isoDate) return false
  return isoDate < todayISO()
}

export const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

export function getAnoOptions() {
  const atual = new Date().getFullYear()
  const anos = []
  for (let y = atual - 4; y <= atual + 1; y++) anos.push(String(y))
  return anos
}

// filtro aceita: '' (todos), 'MM' (só mês, qualquer ano), 'YYYY' (só ano),
// ou 'YYYY-MM' (mês e ano específicos)
export function matchesMonthFilter(isoDate, filtro) {
  if (!filtro) return true
  if (!isoDate) return false
  if (filtro.length === 2) return isoDate.slice(5, 7) === filtro
  return isoDate.startsWith(filtro)
}

export function parseMonthFilter(filtro) {
  if (!filtro) return { mes: '', ano: '' }
  if (filtro.length === 2) return { mes: filtro, ano: '' }
  if (filtro.length === 4) return { mes: '', ano: filtro }
  const [ano, mes] = filtro.split('-')
  return { mes, ano }
}

export function combineMonthFilter(mes, ano) {
  if (mes && ano) return `${ano}-${mes}`
  if (ano) return ano
  if (mes) return mes
  return ''
}
