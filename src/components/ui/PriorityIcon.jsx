export const PRIORITIES = [
  { value: 'urgent', label: 'Срочно',       color: '#E5484D' },
  { value: 'high',   label: 'Высокий',      color: '#F5A524' },
  { value: 'medium', label: 'Средний',      color: '#5E6AD2' },
  { value: 'low',    label: 'Низкий',       color: '#16A34A' },
  { value: 'none',   label: 'Без приоритета', color: 'rgba(26,26,24,0.46)' },
]

export const PRIORITY_BY_VALUE = PRIORITIES.reduce((acc, p) => {
  acc[p.value] = p
  return acc
}, {})

const DIM = 'rgba(17,17,16,0.18)'

export function PriorityBadge({ priority }) {
  const p = PRIORITY_BY_VALUE[priority || 'none']
  if (!p || p.value === 'none') return null
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: p.color + '22', color: p.color }}
    >
      <PriorityIcon priority={priority} size={15} />
      {p.label}
    </span>
  )
}

export function PriorityIcon({ priority, size = 14, className = '' }) {
  const value = priority || 'none'

  if (value === 'urgent') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="3" fill="#E5484D" />
        <rect x="7.1" y="3.5" width="1.8" height="6" rx="0.6" fill="#fff" />
        <rect x="7.1" y="10.7" width="1.8" height="1.8" rx="0.6" fill="#fff" />
      </svg>
    )
  }

  if (value === 'none') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.4"
          strokeDasharray="2 2"
        />
      </svg>
    )
  }

  const filled =
    value === 'high'   ? 3 :
    value === 'medium' ? 2 :
    value === 'low'    ? 1 : 0
  const color =
    value === 'high'   ? '#F5A524' :
    value === 'medium' ? '#5E6AD2' :
    value === 'low'    ? '#16A34A' : DIM

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="1.5"  y="10" width="3" height="4"  rx="0.6" fill={filled >= 1 ? color : DIM} />
      <rect x="6.5"  y="6"  width="3" height="8"  rx="0.6" fill={filled >= 2 ? color : DIM} />
      <rect x="11.5" y="2"  width="3" height="12" rx="0.6" fill={filled >= 3 ? color : DIM} />
    </svg>
  )
}
