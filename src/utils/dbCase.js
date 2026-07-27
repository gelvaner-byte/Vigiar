function toSnakeCase(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function toCamelCase(key) {
  return key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())
}

export function rowToItem(row) {
  const item = {}
  for (const [key, value] of Object.entries(row)) {
    item[toCamelCase(key)] = value
  }
  return item
}

export function itemToRow(item) {
  const row = {}
  for (const [key, value] of Object.entries(item)) {
    row[toSnakeCase(key)] = value
  }
  return row
}
