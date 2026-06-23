import { useEffect } from 'react'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'

export function Toast({ message, type = 'error', onDismiss, duration = 5000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  if (!message) return null

  const isError = type === 'error'
  const accentColor = isError ? '#E5484D' : '#30A46C'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-sm w-full mx-4 animate-slide-in-bottom">
      <div className="glass-panel rounded-md shadow-2xl shadow-black/40 flex items-stretch gap-3 pl-3 pr-3 py-3 text-sm overflow-hidden">
        <div
          className="w-0.5 self-stretch rounded-full flex-shrink-0"
          style={{ background: accentColor }}
        />
        {isError
          ? <AlertCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color: accentColor }} strokeWidth={1.75} />
          : <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: accentColor }} strokeWidth={1.75} />
        }
        <span className="flex-1 leading-snug text-fg-primary self-center">{message}</span>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 self-center w-6 h-6 grid place-items-center rounded text-fg-muted hover:text-fg-primary hover:bg-glass-2 transition-colors"
          aria-label="Закрыть"
        >
          <X size={13} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
