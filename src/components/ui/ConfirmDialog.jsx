import { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export function ConfirmDialog({ title, message, confirmLabel = 'Удалить', onConfirm, onCancel, danger = true, hideCancel = false }) {
  const confirmRef = useRef(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="glass-panel rounded-lg shadow-2xl shadow-black/50 w-full max-w-sm mx-4 p-5 flex flex-col gap-4 animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {danger && (
              <div className="w-9 h-9 rounded-md bg-danger-soft grid place-items-center flex-shrink-0">
                <AlertTriangle size={16} className="text-[#E5484D]" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0 pt-0.5">
              <p className="text-base font-display-tight text-fg-primary">{title}</p>
              {message && <p className="text-sm text-fg-secondary mt-1 leading-relaxed">{message}</p>}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 grid place-items-center rounded-md text-fg-muted hover:text-fg-primary hover:bg-glass-2 flex-shrink-0 transition-colors"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          {!hideCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm font-medium text-fg-secondary hover:text-fg-primary hover:bg-glass-2 rounded-md transition-colors"
            >
              Отмена
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors ${
              danger
                ? 'bg-[#E5484D] hover:bg-[#EF565A]'
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
