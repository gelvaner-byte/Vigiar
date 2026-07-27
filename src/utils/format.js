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
