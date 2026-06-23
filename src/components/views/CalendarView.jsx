import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Plus, ChevronDown, Check } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PRIORITY_BY_VALUE } from '../ui/PriorityIcon'
import { Avatar } from '../ui/Avatar'
import { isOverdue } from '../../utils/date'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const POPUP_W = 240

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function CreatePopup({ dateStr, anchorRect, columns, members, onSubmit, onClose }) {
  const [title, setTitle] = useState('')
  const [colId, setColId] = useState(columns[0]?.id ?? '')
  const [assignees, setAssignees] = useState([])
  const [openDropdown, setOpenDropdown] = useState(null) // 'column' | 'assignee' | null
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const POPUP_H_EST = 220
  const top = Math.max(8, anchorRect.top - 6 - POPUP_H_EST)
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - POPUP_W - 8))

  const selectedCol = columns.find(c => c.id === colId)

  const toggleAssignee = (id) =>
    setAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const submit = async () => {
    const t = title.trim()
    if (!t || loading || !colId) return
    setLoading(true)
    try { await onSubmit(colId, t, assignees) }
    finally { setLoading(false) }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div
        style={{ position: 'fixed', top, left, width: POPUP_W, maxHeight: `${Math.max(200, anchorRect.top - 16)}px` }}
        className="z-[91] bg-surface-2 hairline rounded-xl shadow-lg p-3 flex flex-col gap-2 animate-fade-in overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Название задачи…"
          disabled={loading}
          className="text-sm bg-surface-3 hairline rounded-lg px-2.5 py-1.5 outline-none text-fg-primary placeholder:text-fg-muted w-full disabled:opacity-50"
        />

        {/* Column dropdown */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-fg-muted uppercase tracking-wide px-0.5">Колонка</span>
          <button
            onClick={() => setOpenDropdown(v => v === 'column' ? null : 'column')}
            className="flex items-center justify-between px-2.5 py-1.5 bg-surface-3 hairline rounded-lg text-sm text-fg-primary hover:bg-surface-1 transition-colors"
          >
            <span className="flex items-center gap-1.5 truncate">
              {selectedCol && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCol.color }} />
              )}
              <span className="truncate">{selectedCol?.title ?? 'Выбрать…'}</span>
            </span>
            <ChevronDown size={13} className={`flex-shrink-0 text-fg-muted transition-transform ${openDropdown === 'column' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'column' && (
            <div className="bg-surface-1 hairline rounded-lg overflow-hidden">
              {columns.map(col => (
                <button
                  key={col.id}
                  onClick={() => { setColId(col.id); setOpenDropdown(null) }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-fg-primary hover:bg-surface-3 transition-colors text-left"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="flex-1 truncate">{col.title}</span>
                  {col.id === colId && <Check size={12} className="text-accent flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignee dropdown */}
        {members.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-fg-muted uppercase tracking-wide px-0.5">Исполнители</span>
            <button
              onClick={() => setOpenDropdown(v => v === 'assignee' ? null : 'assignee')}
              className="flex items-center justify-between px-2.5 py-1.5 bg-surface-3 hairline rounded-lg text-sm hover:bg-surface-1 transition-colors"
            >
              <span className="text-fg-primary truncate">
                {assignees.length === 0
                  ? <span className="text-fg-muted">Не назначен</span>
                  : assignees.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(', ')}
              </span>
              <ChevronDown size={13} className={`flex-shrink-0 text-fg-muted transition-transform ${openDropdown === 'assignee' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'assignee' && (
              <div className="bg-surface-1 hairline rounded-lg overflow-hidden max-h-[140px] overflow-y-auto">
                {members.filter(m => m.status === 'accepted').map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleAssignee(m.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left"
                  >
                    <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="xs" />
                    <span className="flex-1 text-sm text-fg-primary truncate">{m.name}</span>
                    {assignees.includes(m.id) && <Check size={12} className="text-accent flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 pt-0.5">
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || loading}
            className="px-2.5 py-1 text-xs bg-accent text-white rounded-lg disabled:opacity-40 hover:bg-accent-hover transition-colors font-medium"
          >
            {loading ? '…' : 'Создать'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

export function CalendarView() {
  const [current, setCurrent] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [popup, setPopup] = useState(null) // { dateStr, anchorRect }

  const { getActiveBoard, setActiveTask, getFilteredTasks, addTaskWithDate, members, activeProjectId } = useStore()
  const board = getActiveBoard()
  const projectMembers = members[activeProjectId] ?? []

  const monthLabel = current.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  const today = new Date()

  const { weeks, allTasks } = useMemo(() => {
    if (!board) return { weeks: [], allTasks: [] }

    const all = board.columns.flatMap(col =>
      (board.tasks[col.id] || []).map(t => ({ ...t, columnTitle: col.title }))
    )
    const filtered = getFilteredTasks(all)

    const year = current.getFullYear()
    const month = current.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startOffset = (firstDay.getDay() + 6) % 7
    const start = new Date(firstDay)
    start.setDate(start.getDate() - startOffset)

    const weeks = []
    let day = new Date(start)
    while (day <= lastDay || weeks.length < 5) {
      const week = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(day))
        day = new Date(day)
        day.setDate(day.getDate() + 1)
      }
      weeks.push(week)
      if (day > lastDay && weeks.length >= 4) break
    }

    return { weeks, allTasks: filtered }
  }, [current, board, getFilteredTasks])

  const getTasksForDay = (date) =>
    allTasks.filter(t => {
      if (t.dueDate && isSameDay(new Date(t.dueDate), date)) return true
      if (!t.dueDate && t.startDate && isSameDay(new Date(t.startDate), date)) return true
      return false
    })

  const openPopup = (e, dateStr) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPopup({ dateStr, anchorRect: rect })
  }

  const handleSubmit = async (colId, title, assignees) => {
    if (popup) await addTaskWithDate(colId, popup.dateStr, title, assignees)
    setPopup(null)
  }

  const columns = board?.columns ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden px-5 py-5">
      <div className="flex flex-col h-full bg-surface-1 hairline rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 hairline-b flex-shrink-0">
          <h2 className="text-base font-semibold text-fg-primary capitalize">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="px-3 py-1 text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3 rounded-lg transition-colors font-medium"
            >
              Сегодня
            </button>
            <button
              onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 flex-shrink-0 hairline-b">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-xs font-semibold ${i >= 5 ? 'text-fg-subtle' : 'text-fg-muted'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 hairline-b">
              {week.map((day, di) => {
                const isToday = isSameDay(day, today)
                const isCurrentMonth = day.getMonth() === current.getMonth()
                const isWeekend = di >= 5
                const dayTasks = getTasksForDay(day)
                const dateStr = toDateStr(day)
                const canCreate = isCurrentMonth && columns.length > 0

                return (
                  <div
                    key={di}
                    className={`group relative p-2 hairline-r last:border-r-0 min-h-[110px] ${
                      isWeekend ? 'bg-surface-3' : 'bg-surface-1'
                    } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                  >
                    {/* Day number + add button */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`w-7 h-7 flex items-center justify-center text-sm font-semibold rounded-full transition-colors ${
                        isToday
                          ? 'bg-accent text-white'
                          : isWeekend
                          ? 'text-fg-subtle'
                          : 'text-fg-secondary'
                      }`}>
                        {day.getDate()}
                      </span>

                      {canCreate && (
                        <button
                          onClick={(e) => openPopup(e, dateStr)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-md text-fg-muted hover:text-fg-primary hover:bg-accent-soft transition-all"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>

                    {/* Task chips */}
                    <div className="flex flex-col gap-0.5">
                      {dayTasks.slice(0, 3).map(task => {
                        const p = PRIORITY_BY_VALUE[task.priority || 'none']
                        const overdue = !task.completed && task.dueDate && isOverdue(task.dueDate)
                        const hasColor = p && p.value !== 'none'
                        return (
                          <button
                            key={task.id}
                            onClick={() => setActiveTask(task.id)}
                            title={task.title}
                            className={`w-full flex items-center px-1.5 py-0.5 rounded text-left text-[11px] font-medium truncate transition-all hover:opacity-80 ${
                              overdue ? 'ring-1 ring-inset ring-danger/50' : ''
                            }`}
                            style={
                              hasColor
                                ? { backgroundColor: p.color + '22', color: p.color }
                                : { backgroundColor: 'var(--color-surface-3)', color: 'var(--color-fg-secondary)' }
                            }
                          >
                            <span className="truncate">{task.title}</span>
                          </button>
                        )
                      })}

                      {dayTasks.length > 3 && (
                        <span className="text-[10px] text-fg-muted px-1">
                          +{dayTasks.length - 3} ещё
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

      </div>

      {popup && (
        <CreatePopup
          dateStr={popup.dateStr}
          anchorRect={popup.anchorRect}
          columns={columns}
          members={projectMembers}
          onSubmit={handleSubmit}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}
