import { Plus } from 'lucide-react'

export function EmptyState({ icon: Icon = Plus, title, hint, onAction, actionLabel }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2 text-center select-none">
      <div className="w-10 h-10 rounded-md glass grid place-items-center mb-1">
        <Icon size={16} className="text-fg-muted" strokeWidth={1.5} />
      </div>
      {title && <p className="text-sm font-display-tight text-fg-secondary">{title}</p>}
      {hint && <p className="text-xs text-fg-muted leading-relaxed max-w-xs">{hint}</p>}
      {onAction && (
        <button
          onClick={onAction}
          className="mt-2 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
