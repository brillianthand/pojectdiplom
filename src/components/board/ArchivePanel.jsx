import { useEffect, useState, useMemo } from 'react'
import { X, ArchiveRestore, Trash2, Search, Calendar, CheckCircle2 } from 'lucide-react'
import { api } from '../../api/index'
import { useStore } from '../../store/useStore'
import { PriorityIcon, PRIORITY_BY_VALUE } from '../ui/PriorityIcon'
import { formatDate, isOverdue } from '../../utils/date'

export function ArchivePanel({ boardId, onClose }) {
  const restoreTask = useStore(s => s.restoreTask)
  const deleteTask  = useStore(s => s.deleteTask)
  const openArchivedTask = useStore(s => s.openArchivedTask)
  const boardName = useStore(s => s.projects.flatMap(p => p.boards).find(b => b.id === boardId)?.name ?? '')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    api.listArchived(boardId)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [boardId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.columnTitle ?? '').toLowerCase().includes(q),
    )
  }, [tasks, query])

  const handleRestore = async (taskId) => {
    await restoreTask(taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
  }

  const handleDelete = async (taskId) => {
    await deleteTask(taskId)
    setTasks(ts => ts.filter(t => t.id !== taskId))
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans animate-fade-in">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-bg flex flex-col hairline-l">
        {/* Header */}
        <div className="px-8 pt-9 pb-7 hairline-b flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <span />
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="-mr-1 -mt-1 w-7 h-7 grid place-items-center text-fg-muted hover:text-fg-primary transition-colors"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-baseline gap-4">
            <h1 className="text-4xl font-display-tight text-fg-primary leading-[0.95]">
              Архив
            </h1>
            {!loading && (
              <span className="text-xs font-mono text-fg-subtle tabular-nums">
                {tasks.length} {tasks.length === 1 ? 'задача' : tasks.length >= 2 && tasks.length <= 4 ? 'задачи' : 'задач'}
              </span>
            )}
          </div>

          {tasks.length > 0 && (
            <div className="mt-6 flex items-center gap-2 px-3 h-9 bg-surface-3 rounded-md focus-within:ring-1 focus-within:ring-line-accent transition">
              <Search size={13} strokeWidth={1.75} className="text-fg-muted flex-shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск"
                className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-muted outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-fg-muted hover:text-fg-primary transition-colors"
                >
                  <X size={12} strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="px-6 py-5 space-y-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-[72px] bg-surface-3/50 animate-pulse rounded-lg" />
              ))}
            </div>
          )}

          {!loading && tasks.length === 0 && (
            <div className="px-8 py-14">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted mb-3">— Пусто</p>
              <p className="text-sm text-fg-secondary leading-relaxed">
                Архивированные задачи появятся здесь. <br/>
                Откройте задачу и выберите «Архивировать».
              </p>
            </div>
          )}

          {!loading && tasks.length > 0 && filtered.length === 0 && (
            <div className="px-8 py-10">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted mb-3">— Ничего не найдено</p>
              <p className="text-sm text-fg-secondary">
                По запросу «{query}» нет результатов.
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="px-6 py-5 space-y-2">
              {filtered.map(task => (
                <ArchivedTaskRow
                  key={task.id}
                  task={task}
                  boardName={boardName}
                  onOpen={() => openArchivedTask(task.id)}
                  onRestore={() => handleRestore(task.id)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ArchivedTaskRow({ task, boardName, onOpen, onRestore, onDelete }) {
  const priority = PRIORITY_BY_VALUE[task.priority || 'none']
  const hasPriority = priority && priority.value !== 'none'
  const due = task.dueDate ? { label: formatDate(task.dueDate), overdue: isOverdue(task.dueDate) && !task.completed } : null

  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group relative bg-surface-2 hairline rounded-lg cursor-pointer hover:border-line-strong hover:shadow-sm transition-all"
    >
      <div className="px-4 py-3">
        {/* Заголовок */}
        <div className="flex items-start gap-2.5">
          {hasPriority && (
            <span className="flex-shrink-0 mt-[2px]" title={priority.label}>
              <PriorityIcon priority={task.priority} size={13} />
            </span>
          )}
          <p className={`flex-1 min-w-0 text-sm leading-snug ${task.completed ? 'text-fg-muted line-through' : 'text-fg-primary'}`}>
            {task.title}
          </p>
          {task.completed && (
            <span
              className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-medium text-success bg-success-soft"
              title="Задача была выполнена"
            >
              <CheckCircle2 size={10} strokeWidth={2.25} />
              выполнена
            </span>
          )}
        </div>

        {/* Мета-ряд: колонка, срок, действия */}
        <div className="flex items-center justify-between mt-2.5 min-h-[22px]">
          <div className="flex items-center gap-2 min-w-0">
            {boardName && (
              <span className="text-[11px] truncate max-w-[220px]">
                <span className="text-fg-subtle">Доска </span>
                <span className="text-fg-primary">{boardName}</span>
              </span>
            )}
            {due && (
              <span className={`inline-flex items-center gap-1 text-[11px] ${due.overdue ? 'text-danger' : 'text-fg-muted'}`}>
                <Calendar size={11} strokeWidth={1.75} />
                <span className="tabular-nums">{due.label}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={stop(onRestore)}
              title="Восстановить"
              className="inline-flex items-center gap-1.5 h-7 px-2 text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-surface-3 rounded-md transition-colors"
            >
              <ArchiveRestore size={12} strokeWidth={1.75} />
              Восстановить
            </button>
            <button
              onClick={stop(onDelete)}
              title="Удалить навсегда"
              className="w-7 h-7 grid place-items-center text-fg-muted hover:text-danger hover:bg-danger-soft rounded-md transition-colors"
            >
              <Trash2 size={12} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
