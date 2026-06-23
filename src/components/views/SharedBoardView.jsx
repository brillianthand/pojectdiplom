import { useEffect, useState } from 'react'
import { Eye, LogIn, AlertCircle, Tag as TagIcon } from 'lucide-react'
import { PriorityBadge } from '../ui/PriorityIcon'
import { Avatar } from '../ui/Avatar'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function SharedTaskCard({ task }) {
  const subtasksDone = (task.subtasks || []).filter(s => s.completed).length
  const subtasksTotal = (task.subtasks || []).length

  return (
    <div className={`rounded-xl border shadow-sm bg-surface-2 border-line p-4 ${task.completed ? 'opacity-60' : ''}`}>
      <p className={`text-sm leading-snug text-fg-primary ${task.completed ? 'line-through text-fg-muted' : ''}`}>
        {task.title}
      </p>

      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {task.tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-3 text-fg-secondary">
              <TagIcon size={9} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-1.5">
          {task.priority && <PriorityBadge priority={task.priority} />}
          {subtasksTotal > 0 && (
            <span className="text-[11px] text-fg-muted">
              {subtasksDone}/{subtasksTotal}
            </span>
          )}
        </div>
        {task.assignees?.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-surface-3 border border-line ring-1 ring-surface-2 flex items-center justify-center text-[9px] font-medium text-fg-secondary">
                {typeof a === 'string' ? a.slice(0, 2).toUpperCase() : '?'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SharedColumn({ column, tasks }) {
  return (
    <div className="flex flex-col w-72 flex-shrink-0 rounded-xl bg-surface-1 shadow-md overflow-hidden">
      <div
        className="px-3 py-2.5 flex items-center gap-2"
        style={{
          backgroundColor: column.color + 'cc',
          backdropFilter: 'blur(8px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)',
        }}
      >
        <h3 className="text-sm font-semibold truncate flex-1" style={{ color: column.textColor }}>
          {column.title}
        </h3>
        <span
          className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0"
          style={{ backgroundColor: column.textColor + '22', color: column.textColor }}
        >
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 p-2 min-h-[80px] overflow-y-auto bg-surface-1">
        {tasks.map(task => (
          <SharedTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

export function SharedBoardView({ token }) {
  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  useEffect(() => {
    fetch(`${BASE}/api/shared/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('not_found')
        return r.json()
      })
      .then(setBoard)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-fg-muted text-sm animate-pulse">Загрузка доски…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <AlertCircle size={40} strokeWidth={1.25} className="text-fg-muted" />
        <p className="text-fg-secondary font-medium">Доска не найдена</p>
        <p className="text-sm text-fg-muted">Ссылка недействительна или доступ закрыт</p>
        <a
          href="/"
          className="mt-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          На главную
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-surface-1 border-b border-line flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-display-tight text-fg-primary">{board.name}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-3 text-xs font-medium text-fg-muted">
            <Eye size={11} strokeWidth={1.75} />
            Только просмотр
          </span>
        </div>
        <a
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          <LogIn size={14} strokeWidth={1.75} />
          Войти
        </a>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full px-5 py-5 items-start">
          {board.columns.map(col => (
            <SharedColumn
              key={col.id}
              column={col}
              tasks={board.tasks[col.id] || []}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
