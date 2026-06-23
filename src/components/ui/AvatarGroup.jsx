import { Avatar } from './Avatar'

const SIZE_CLASS = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

export function AvatarGroup({
  members,
  max = 2,
  size = 'sm',
  ringClass = '',
  overflowClass = 'bg-surface-700 text-white/70 dark:bg-surface-700 dark:text-white/70',
}) {
  if (!members?.length) return null

  const visible = members.slice(0, max)
  const extra = members.length - visible.length
  const sz = SIZE_CLASS[size] ?? SIZE_CLASS.sm

  return (
    <div className="flex -space-x-1.5">
      {visible.map(m => (
        <Avatar
          key={m.id ?? m.initials}
          initials={m?.initials ?? '?'}
          color={m?.color}
          avatarUrl={m?.avatarUrl}
          size={size}
          className={ringClass}
        />
      ))}
      {extra > 0 && (
        <div
          className={`${sz} ${overflowClass} ${ringClass} rounded-full grid place-items-center font-display-tight select-none flex-shrink-0`}
          title={`Ещё ${extra}`}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
