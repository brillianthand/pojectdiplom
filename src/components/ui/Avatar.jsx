const FALLBACK_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B',
  '#F43F5E', '#8B5CF6', '#06B6D4',
]

const SIZE_CLASS = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-20 h-20 text-2xl',
}

export function Avatar({ initials, size = 'sm', color, avatarUrl, className = '' }) {
  const sz = SIZE_CLASS[size] ?? SIZE_CLASS.sm

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={initials || ''}
        draggable={false}
        className={`${sz} rounded-full object-cover bg-surface-2 select-none flex-shrink-0 ${className}`}
      />
    )
  }

  const bg = color || FALLBACK_COLORS[(initials ? initials.charCodeAt(0) : 0) % FALLBACK_COLORS.length]
  return (
    <div
      className={`${sz} rounded-full grid place-items-center font-display-tight text-white select-none flex-shrink-0 ${className}`}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  )
}
