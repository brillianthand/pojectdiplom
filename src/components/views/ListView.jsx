import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronRight, Plus, Check, X, Search, MessageSquare } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Tag, PriorityBadge, colorsForTags } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { EmptyState } from '../ui/EmptyState'
import { formatDateRelative, isOverdue } from '../../utils/date'

const GRID_COLS = 'grid-cols-[minmax(0,1fr)_180px_120px_120px]'

function loadCollapsed(boardId) {
  if (!boardId) return new Set()
  try {
    const raw = localStorage.getItem(`kanban_list_collapsed_${boardId}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(boardId, set) {
  if (!boardId) return
  try {
    localStorage.setItem(`kanban_list_collapsed_${boardId}`, JSON.stringify([...set]))
  } catch { /* ignore */ }
}

function CompletionCircle({ completed, color, textColor }) {
  if (completed) {
    return (
      <span className="inline-flex w-3.5 h-3.5 rounded-full bg-success items-center justify-center flex-shrink-0">
        <Check size={8} strokeWidth={3} className="text-white" />
      </span>
    )
  }
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color, boxShadow: `inset 0 0 0 1.5px ${textColor}` }}
    />
  )
}

function GroupHeader({ column, count, collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="col-span-full flex items-center gap-2 px-4 h-10 hairline-b bg-surface-1 hover:bg-surface-2 transition-colors text-left"
    >
      <ChevronRight
        size={14}
        strokeWidth={2}
        className={`text-fg-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
      />
      <span className="text-sm font-semibold" style={{ color: column.textColor }}>
        {column.title}
      </span>
      <span
        className="min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full text-xs font-semibold"
        style={{ backgroundColor: column.textColor + '22', color: column.textColor }}
      >
        {count}
      </span>
    </button>
  )
}

function TaskRow({ task, column, members, onOpen, onToggleComplete }) {
  const assignees = task.assignees
    .map(id => members.find(m => m.id === id))
    .filter(Boolean)

  const due = task.dueDate
  const overdue = isOverdue(due) && !task.completed

  return (
    <div
      onClick={onOpen}
      className="col-span-full grid grid-cols-subgrid h-11 items-center hairline-b cursor-pointer hover:bg-surface-2 transition-colors"
    >
      {/* TITLE */}
      <div className="flex items-center gap-2.5 min-w-0 pl-10 pr-4">
        <button
          onClick={e => { e.stopPropagation(); onToggleComplete() }}
          className="flex-shrink-0 rounded-full hover:scale-110 transition-transform"
          title={task.completed ? 'Отметить активной' : 'Завершить задачу'}
        >
          <CompletionCircle completed={task.completed} color={column.color} textColor={column.textColor} />
        </button>
        <span
          className={`text-sm truncate ${
            task.completed ? 'line-through text-fg-muted' : 'text-fg-primary'
          }`}
        >
          {task.title}
        </span>
        {task.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {colorsForTags(task.tags).slice(0, 3).map((color, i) => (
              <Tag key={task.tags[i]} label={task.tags[i]} color={color} />
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs text-fg-muted">+{task.tags.length - 3}</span>
            )}
          </div>
        )}
        {task.comments?.length > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-fg-muted flex-shrink-0 ml-1">
            <MessageSquare size={11} />
            {task.comments.length}
          </span>
        )}
      </div>

      {/* ASSIGNEE */}
      <div className="flex items-center min-w-0 pr-4">
        {assignees.length === 0 ? (
          <span className="text-sm text-fg-subtle">—</span>
        ) : assignees.length === 1 ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar initials={assignees[0].initials} color={assignees[0].color} avatarUrl={assignees[0].avatarUrl} size="sm" />
            <span className="text-sm text-fg-secondary truncate">{assignees[0].name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map(m => (
                <Avatar
                  key={m.id}
                  initials={m.initials}
                  color={m.color}
                  size="sm"
                  className="ring-2 ring-surface-1"
                />
              ))}
            </div>
            <span className="text-sm text-fg-secondary truncate">{assignees.length}</span>
          </div>
        )}
      </div>

      {/* DUE DATE */}
      <div className={`text-sm tabular-nums pr-4 ${overdue ? 'text-danger' : 'text-fg-secondary'}`}>
        {due ? formatDateRelative(due) : <span className="text-fg-subtle">—</span>}
      </div>

      {/* PRIORITY */}
      <div className="flex items-center pr-4">
        {task.priority
          ? <PriorityBadge priority={task.priority} />
          : <span className="text-sm text-fg-subtle">—</span>}
      </div>
    </div>
  )
}

function AddTaskRow({ columnId, onAdd }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const submit = () => {
    if (submittingRef.current) return
    submittingRef.current = true
    const t = draft.trim()
    if (t) onAdd(columnId, t)
    setDraft('')
    setEditing(false)
    setTimeout(() => { submittingRef.current = false }, 0)
  }

  const cancel = () => {
    setDraft('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="col-span-full flex items-center h-8 hairline-b pl-10">
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 px-2 py-0.5 text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3 rounded transition-colors"
        >
          <Plus size={12} strokeWidth={1.75} />
          Добавить задачу
        </button>
      </div>
    )
  }

  return (
    <div className="col-span-full flex items-center gap-2 px-4 h-10 hairline-b bg-surface-2">
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        onBlur={submit}
        placeholder="Название задачи..."
        className="flex-1 h-7 px-2 text-sm bg-surface-1 border border-line-accent rounded-md text-fg-primary placeholder:text-fg-muted outline-none"
      />
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={submit}
        className="w-7 h-7 grid place-items-center rounded-md bg-accent hover:bg-accent-hover text-white transition-colors"
        title="Добавить"
      >
        <Check size={13} strokeWidth={2} />
      </button>
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={cancel}
        className="w-7 h-7 grid place-items-center rounded-md text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
        title="Отменить"
      >
        <X size={13} strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function ListView() {
  const {
    getActiveBoard, getFilteredTasks, setActiveTask,
    addTask, updateTask, members, activeProjectId, projects,
    filters, searchQuery,
  } = useStore()
  const board = getActiveBoard()
  const projectMembers = members[activeProjectId] ?? []

  const activeProject = projects.find(p => p.id === activeProjectId)
  const boardId = activeProject?.activeBoardId

  const [collapsed, setCollapsed] = useState(() => loadCollapsed(boardId))
  const [prevBoardId, setPrevBoardId] = useState(boardId)
  if (prevBoardId !== boardId) {
    setPrevBoardId(boardId)
    setCollapsed(loadCollapsed(boardId))
  }

  const toggleCollapsed = (colId) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else                 next.add(colId)
      saveCollapsed(boardId, next)
      return next
    })
  }

  const groups = useMemo(() => {
    if (!board) return []
    return board.columns.map(col => {
      const all = board.tasks[col.id] || []
      const filtered = getFilteredTasks(all)
      return { column: col, tasks: filtered, totalRaw: all.length }
    })
  }, [board, getFilteredTasks, filters, searchQuery])

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-muted text-sm">
        Нет доски
      </div>
    )
  }

  if (board.columns.length === 0) {
    return (
      <div className="flex-1 grid place-items-center p-8">
        <EmptyState
          icon={Plus}
          title="Колонок пока нет"
          hint="Добавьте первую колонку на доске, чтобы начать работу"
        />
      </div>
    )
  }

  const totalAfterFilter = groups.reduce((s, g) => s + g.tasks.length, 0)
  const totalRaw         = groups.reduce((s, g) => s + g.totalRaw, 0)
  const allFilteredOut   = totalRaw > 0 && totalAfterFilter === 0

  return (
    <div className="h-full overflow-auto bg-surface-1">
      <div className={`grid ${GRID_COLS} min-w-[760px]`}>
        {/* Sticky header */}
        <div
          className="col-span-full grid grid-cols-subgrid items-center h-9 hairline-b bg-surface-1 sticky top-0 z-10"
        >
          <div className="text-2xs font-semibold text-fg-muted uppercase tracking-wider px-4">Название</div>
          <div className="text-2xs font-semibold text-fg-muted uppercase tracking-wider pr-4">Исполнитель</div>
          <div className="text-2xs font-semibold text-fg-muted uppercase tracking-wider pr-4">Дедлайн</div>
          <div className="text-2xs font-semibold text-fg-muted uppercase tracking-wider pr-4">Приоритет</div>
        </div>

        {groups.map(({ column, tasks, totalRaw }) => {
          const isCollapsed = collapsed.has(column.id)
          return (
            <div key={column.id} className="col-span-full grid grid-cols-subgrid">
              <GroupHeader
                column={column}
                count={tasks.length}
                collapsed={isCollapsed}
                onToggle={() => toggleCollapsed(column.id)}
              />

              {!isCollapsed && (
                <>
                  {tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      column={column}
                      members={projectMembers}
                      onOpen={() => setActiveTask(task.id)}
                      onToggleComplete={() => updateTask(task.id, { completed: !task.completed })}
                    />
                  ))}
                  {tasks.length === 0 && totalRaw > 0 && (
                    <div className="col-span-full px-4 py-2 text-xs text-fg-muted hairline-b">
                      Нет задач, соответствующих фильтру
                    </div>
                  )}
                  <AddTaskRow columnId={column.id} onAdd={addTask} />
                </>
              )}
            </div>
          )
        })}

        {allFilteredOut && (
          <div className="col-span-full p-12 grid place-items-center">
            <EmptyState
              icon={Search}
              title="Нет совпадений"
              hint="Попробуйте изменить фильтры или поисковый запрос"
            />
          </div>
        )}
      </div>
    </div>
  )
}
