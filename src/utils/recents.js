const KEY = 'kanban_recents'
const MAX = 6

export function getRecents() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function addRecent(item) {
  const list = getRecents().filter(r => !(r.type === item.type && r.id === item.id))
  list.unshift({ ...item, ts: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function clearRecents() {
  localStorage.removeItem(KEY)
}
