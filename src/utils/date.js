export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// Parse a 'YYYY-MM-DD' string as a *local* date (new Date('YYYY-MM-DD')
// parses as UTC, which shifts the day in non-UTC timezones).
function toLocalDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(dateStr)
}

// Smart relative label for a due date: «Сегодня / Завтра / Вчера / 3 дн. назад»,
// short weekday within the next week, otherwise «29 мая».
export function formatDateRelative(dateStr) {
  if (!dateStr) return ''
  const d = toLocalDate(dateStr); d.setHours(0, 0, 0, 0)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = Math.round((d - now) / 86400000)
  if (diff === 0)  return 'Сегодня'
  if (diff === 1)  return 'Завтра'
  if (diff === -1) return 'Вчера'
  if (diff < 0)    return `${Math.abs(diff)} дн. назад`
  if (diff < 7)    return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function formatRange(start, end) {
  if (!start && !end) return null
  const endDate = end ? new Date(end) : null
  const overdue = endDate && endDate < new Date()
  const label = start && end
    ? `${formatDate(start)} — ${formatDate(end)}`
    : formatDate(start || end)
  return { label, overdue: !!overdue }
}

export function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}
