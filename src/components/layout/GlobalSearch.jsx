import { useEffect, useRef, useState } from 'react'
import { Search, X, LayoutDashboard } from 'lucide-react'
import { api } from '../../api/index'
import { useStore } from '../../store/useStore'

export function GlobalSearch({ onClose }) {
  const navigateToTask = useStore(s => s.navigateToTask)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const data = await api.search(query).catch(() => [])
      setResults(data)
      setActive(0)
      setLoading(false)
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const handleSelect = (r) => {
    navigateToTask(r.taskId, r.boardId, r.projectId)
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) handleSelect(results[active])
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-surface-1 border border-line-strong rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <Search size={15} strokeWidth={1.75} className="text-fg-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск задач по всем проектам..."
            className="flex-1 text-sm text-fg-primary bg-transparent outline-none placeholder:text-fg-muted"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-fg-muted hover:text-fg-primary transition-colors">
              <X size={13} />
            </button>
          )}
          <kbd className="hidden sm:block text-[10px] text-fg-muted border border-line rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-fg-muted">Поиск…</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-fg-muted">Ничего не найдено</div>
          )}
          {!loading && results.length > 0 && results.map((r, i) => (
            <button
              key={r.taskId}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
              }`}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-md bg-surface-3 grid place-items-center text-fg-muted">
                <LayoutDashboard size={13} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-fg-primary truncate">{r.title}</p>
                <p className="text-xs text-fg-muted truncate">{r.boardName} · {r.columnTitle}</p>
              </div>
            </button>
          ))}
          {!loading && query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-fg-muted">
              Введите минимум 2 символа
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
