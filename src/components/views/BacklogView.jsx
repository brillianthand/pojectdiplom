import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ChevronDown, X, Check, MoreHorizontal, Pencil, Trash2, User } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { usePermissions } from '../../lib/permissions'
import { PriorityIcon } from '../ui/PriorityIcon'
import { Avatar } from '../ui/Avatar'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

/* ── Меню спринта (три точки) ──────────────────────────────────────────── */
function SprintMenu({ sprint, pos, onClose, onEdit, onDelete }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: 180, zIndex: 200 }}
      className="bg-surface-2 border border-line shadow-lg py-1"
    >
      <button
        onClick={() => { onEdit(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-3 transition-colors"
      >
        <Pencil size={13} />
        Изменить спринт
      </button>
      <div className="my-1 border-t border-line" />
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger-soft transition-colors"
      >
        <Trash2 size={13} />
        Удалить спринт
      </button>
    </div>,
    document.body
  )
}

/* ── Форма редактирования спринта ──────────────────────────────────────── */
const DURATIONS = [
  { label: '1 неделя',  weeks: 1 },
  { label: '2 недели',  weeks: 2 },
  { label: '3 недели',  weeks: 3 },
]

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

function EditSprintForm({ sprint, onClose }) {
  const { updateSprint } = useStore()
  const [name,     setName]     = useState(sprint.name)
  const [goal,     setGoal]     = useState(sprint.goal || '')
  const [duration, setDuration] = useState(2) // weeks
  const [loading,  setLoading]  = useState(false)

  const handleSave = async () => {
    setLoading(true)
    const startDate = new Date().toISOString().slice(0, 10)
    const endDate   = addWeeks(startDate, duration)
    await updateSprint(sprint.id, { name: name.trim(), goal: goal.trim(), startDate, endDate })
    setLoading(false)
    onClose()
  }

  return (
    <div className="px-4 py-3 border-b border-line bg-surface-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-fg-primary">Изменить спринт</span>
        <button onClick={onClose} className="text-fg-muted hover:text-fg-primary"><X size={14} /></button>
      </div>

      <div className="flex flex-col gap-3 mb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Название</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Спринт N"
              className="h-8 px-2.5 text-sm bg-surface-2 border border-line-accent text-fg-primary placeholder:text-fg-muted outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Цель</label>
            <input
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Опционально"
              className="h-8 px-2.5 text-sm bg-surface-2 border border-line-accent text-fg-primary placeholder:text-fg-muted outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Длительность</label>
          <div className="flex items-center gap-1">
            {DURATIONS.map(d => (
              <button
                key={d.weeks}
                onClick={() => setDuration(d.weeks)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  duration === d.weeks
                    ? 'bg-accent text-white border-accent'
                    : 'border-line text-fg-secondary hover:bg-surface-2 hover:text-fg-primary'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={onClose} className="h-7 px-3 text-xs text-fg-secondary border border-line hover:bg-surface-3 transition-colors">Отмена</button>
        <button onClick={handleSave} disabled={loading} className="h-7 px-3 text-xs bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
          {loading ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

/* ── Строка задачи ─────────────────────────────────────────────────────── */
function TaskRow({ task, users, boardColumns, isOverlay }) {
  const { setActiveTask } = useStore()
  const perms = usePermissions()

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !perms.canEditTasks,
  })

  const col         = boardColumns?.find(c => c.id === task.columnId)
  const statusBg    = col?.color     || '#e2e8f0'
  const statusFg    = col?.textColor || '#475569'
  const statusText  = col?.title     || 'Backlog'

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={[
        'flex items-center gap-3 px-4 h-10 hairline-b last:border-b-0',
        'hover:bg-surface-3 transition-colors select-none',
        isDragging ? 'opacity-20' : '',
        isOverlay  ? 'bg-surface-2 shadow-lg cursor-grabbing' : 'cursor-grab',
      ].join(' ')}
    >
      <span
        className={`flex-1 text-[13px] text-fg-primary truncate`}
        onClick={e => { e.stopPropagation(); setActiveTask(task.id) }}
      >
        {task.title}
      </span>

      <div className="flex items-center gap-4 flex-shrink-0">
        {task.columnId !== boardColumns?.[0]?.id && (
          <span
            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 truncate max-w-[110px] text-fg-primary"
            style={{ backgroundColor: statusBg + '40' }}
          >
            {statusText}
          </span>
        )}
        {task.dueDate && (
          <span className="text-[11px] font-mono text-fg-muted w-14 text-right">
            {formatDate(task.dueDate)}
          </span>
        )}
        <PriorityIcon priority={task.priority} size={13} className={!task.priority || task.priority === 'none' ? 'text-fg-primary' : ''} />
        <div className="w-5 flex justify-end">
          {task.assignees?.length > 0 ? (
            <Avatar
              initials={users.find(u => u.id === task.assignees[0])?.initials}
              color={users.find(u => u.id === task.assignees[0])?.color}
              avatarUrl={users.find(u => u.id === task.assignees[0])?.avatarUrl}
              size="xs"
            />
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-fg-primary/40 flex items-center justify-center text-fg-primary">
              <User size={11} strokeWidth={2} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Коробка спринта ───────────────────────────────────────────────────── */
function SprintBox({
  type, sprint, tasks, boardId, boardColumns, users,
  onStart, onComplete, onCreateSprint, onAdd,
}) {
  const [expanded,   setExpanded]   = useState(true)
  const [adding,     setAdding]     = useState(false)
  const [draft,      setDraft]      = useState('')
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [menuPos,    setMenuPos]    = useState({ top: 0, left: 0 })
  const [editing,    setEditing]    = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const menuTriggerRef = useRef(null)
  const { deleteSprint } = useStore()
  const perms = usePermissions()

  const openMenu = e => {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); return }
    const r = menuTriggerRef.current?.getBoundingClientRect()
    if (r) {
      const menuW = 180, menuH = 80, margin = 4
      const top  = r.bottom + margin + menuH > window.innerHeight ? r.top - margin - menuH : r.bottom + margin
      let   left = r.right - menuW
      if (left < 8) left = 8
      setMenuPos({ top, left })
    }
    setMenuOpen(true)
  }

  const { setNodeRef, isOver } = useDroppable({
    id: sprint ? sprint.id : 'backlog',
  })

  const isBacklog = type === 'backlog'
  const title     = isBacklog ? 'Backlog' : sprint.name
  const dateStr   = !isBacklog && sprint?.startDate && sprint?.endDate
    ? `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}`
    : ''

  const handleAdd = async () => {
    const t = draft.trim()
    if (!t || !boardColumns?.[0]?.id) return
    await onAdd(boardColumns[0].id, t)
    setDraft('')
    setAdding(false)
  }

  /* Active sprint header tint */
  const headerStyle = type === 'active'
    ? { borderLeft: '3px solid #16A34A' }
    : type === 'planning'
      ? { borderLeft: '3px solid rgba(17,17,16,.18)' }
      : {}

  return (
    <div
      className={`border border-line bg-surface-2 transition-colors ${isOver ? 'border-accent' : ''}`}
      style={{ outline: isOver ? '2px solid rgba(17,17,16,.08)' : undefined }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-surface-1 border-b border-line"
        style={headerStyle}
      >
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded(v => !v)}
        >
          <ChevronDown
            size={13}
            strokeWidth={2}
            className={`text-fg-muted transition-transform flex-shrink-0 ${!expanded ? '-rotate-90' : ''}`}
          />
          <span className="text-sm font-semibold text-fg-primary truncate">{title}</span>
          <span className="text-[11px] text-fg-muted flex-shrink-0">
            ({tasks.length} {tasks.length === 1 ? 'задача' : tasks.length >= 2 && tasks.length <= 4 ? 'задачи' : 'задач'})
          </span>
          {dateStr && (
            <span className="text-[11px] font-mono text-fg-muted ml-1 flex-shrink-0">{dateStr}</span>
          )}
          {type === 'active' && (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-success-soft text-success flex-shrink-0">
              активный
            </span>
          )}
        </button>

        {perms.canManageBoards && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {type === 'active' && (
              <button
                onClick={onComplete}
                className="px-2.5 py-1 text-[11px] font-medium border border-line text-fg-primary hover:bg-surface-3 transition-colors"
              >
                Завершить спринт
              </button>
            )}
            {type === 'planning' && (
              <>
                <button
                  onClick={onStart}
                  className="px-2.5 py-1 text-[11px] font-medium border border-line text-fg-primary hover:bg-surface-3 transition-colors"
                >
                  Начать спринт
                </button>
                <button
                  ref={menuTriggerRef}
                  onClick={openMenu}
                  className="w-6 h-6 grid place-items-center text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
                  title="Действия"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <SprintMenu
                    sprint={sprint}
                    pos={menuPos}
                    onClose={() => setMenuOpen(false)}
                    onEdit={() => setEditing(true)}
                    onDelete={() => setConfirmDel(true)}
                  />
                )}
              </>
            )}
            {type === 'backlog' && (
              <button
                onClick={onCreateSprint}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border border-line text-fg-primary hover:bg-surface-3 transition-colors"
              >
                <Plus size={11} />
                Создать спринт
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && sprint && (
        <EditSprintForm sprint={sprint} onClose={() => setEditing(false)} />
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <ConfirmDialog
          title={`Удалить «${sprint?.name}»?`}
          message="Спринт будет удалён, задачи вернутся в бэклог."
          confirmLabel="Удалить"
          onConfirm={async () => { await deleteSprint(sprint.id); setConfirmDel(false) }}
          onCancel={() => setConfirmDel(false)}
        />
      )}

      {/* Body */}
      {expanded && (
        <div ref={setNodeRef} className="flex flex-col min-h-[4px]">
          {tasks.length === 0 && !adding ? (
            <div className="px-4 py-3 text-[13px] text-fg-muted">
              {isBacklog ? 'Бэклог пуст' : 'Перетащите задачи сюда'}
            </div>
          ) : (
            tasks.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                users={users}
                boardColumns={boardColumns}
              />
            ))
          )}

          {/* Add task */}
          {perms.canEditTasks && (
            <div className="px-4 py-2 border-t border-line">
              {!adding ? (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3 rounded-sm transition-colors"
                >
                  <Plus size={12} strokeWidth={1.75} />
                  Добавить задачу
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { e.preventDefault(); handleAdd() }
                      if (e.key === 'Escape') { setAdding(false); setDraft('') }
                    }}
                    placeholder="Название задачи..."
                    className="flex-1 h-7 px-2 text-sm bg-surface-1 border border-line-accent text-fg-primary placeholder:text-fg-muted outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={handleAdd}
                    className="w-7 h-7 grid place-items-center bg-accent hover:bg-accent-hover text-white transition-colors"
                    title="Добавить"
                  >
                    <Check size={13} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => setAdding(false)}
                    className="w-7 h-7 grid place-items-center text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
                    title="Отменить"
                  >
                    <X size={13} strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Форма создания спринта ────────────────────────────────────────────── */
function CreateSprintForm({ boardId, onClose }) {
  const { createSprint } = useStore()
  const [name,     setName]     = useState('')
  const [goal,     setGoal]     = useState('')
  const [duration, setDuration] = useState(2) // weeks
  const [loading,  setLoading]  = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    const startDate = new Date().toISOString().slice(0, 10)
    const endDate   = addWeeks(startDate, duration)
    const sp = await createSprint(boardId, { name: name.trim(), goal: goal.trim(), startDate, endDate })
    setLoading(false)
    if (sp) { setName(''); setGoal(''); onClose() }
  }

  return (
    <div className="border border-line bg-surface-2 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-fg-primary">Новый спринт</span>
        <button onClick={onClose} className="text-fg-muted hover:text-fg-primary">
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Название</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Спринт N"
              className="h-8 px-2.5 text-sm bg-surface-1 border border-line-accent text-fg-primary placeholder:text-fg-muted outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Цель</label>
            <input
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Опционально"
              className="h-8 px-2.5 text-sm bg-surface-1 border border-line-accent text-fg-primary placeholder:text-fg-muted outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Длительность</label>
          <div className="flex items-center gap-1">
            {DURATIONS.map(d => (
              <button
                key={d.weeks}
                onClick={() => setDuration(d.weeks)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  duration === d.weeks
                    ? 'bg-accent text-white border-accent'
                    : 'border-line text-fg-secondary hover:bg-surface-3 hover:text-fg-primary'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onClose}
          className="h-7 px-3 text-xs text-fg-secondary border border-line hover:bg-surface-3 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="h-7 px-3 text-xs bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Создание…' : 'Создать'}
        </button>
      </div>
    </div>
  )
}

/* ── Завершённые спринты ───────────────────────────────────────────────── */
function CompletedSprints({ sprints }) {
  const [open, setOpen] = useState(false)
  const completed = sprints.filter(s => s.status === 'completed')
  if (!completed.length) return null

  return (
    <div className="border border-line bg-surface-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-surface-1 border-b border-line hover:bg-surface-3 transition-colors text-left"
      >
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={`text-fg-muted transition-transform flex-shrink-0 ${!open ? '-rotate-90' : ''}`}
        />
        <span className="text-sm font-semibold text-fg-secondary">Завершённые спринты</span>
        <span className="text-[11px] text-fg-muted">({completed.length})</span>
      </button>
      {open && completed.map(sprint => (
        <div
          key={sprint.id}
          className="flex items-center justify-between px-10 h-9 border-b border-line last:border-b-0 hover:bg-surface-3 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-fg-secondary">{sprint.name}</span>
            {sprint.startDate && sprint.endDate && (
              <span className="text-[11px] font-mono text-fg-muted">
                {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono text-fg-muted">
            {sprint.completedTasks}/{sprint.totalTasks} выполнено
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Главный компонент ─────────────────────────────────────────────────── */
export function BacklogView() {
  const {
    projects, activeProjectId, boards,
    sprintData, sprintLoading,
    loadSprints, members, addTask,
    completeSprint, startSprint, setTaskSprint,
  } = useStore()

  const project      = projects.find(p => p.id === activeProjectId)
  const boardId      = project?.activeBoardId
  const board        = boardId ? boards[boardId] : null
  const users        = members[activeProjectId] ?? []

  const data          = boardId ? sprintData[boardId] : null
  const sprints       = data?.sprints      ?? []
  const backlogTasks  = data?.backlogTasks ?? []

  const activeSprint    = sprints.find(s => s.status === 'active')
  const planningSprints = sprints.filter(s => s.status === 'planning')

  const [completingSprint, setCompletingSprint] = useState(null)
  const [creatingSprint,   setCreatingSprint]   = useState(false)
  const [activeDragTask,   setActiveDragTask]   = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    if (boardId) loadSprints(boardId)
  }, [boardId, loadSprints])

  if (!board) return null

  const handleDragStart = e =>
    setActiveDragTask(backlogTasks.find(t => t.id === e.active.id) ?? null)

  const handleDragEnd = async e => {
    const { active, over } = e
    setActiveDragTask(null)
    if (!over) return
    const taskId       = active.id
    const targetSprint = over.id === 'backlog' ? null : over.id
    const task = backlogTasks.find(t => t.id === taskId)
    if (task && task.sprintId !== targetSprint) {
      await setTaskSprint(taskId, targetSprint, boardId)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-[1000px] w-full mx-auto px-6 py-6 flex flex-col gap-3">

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Активный спринт */}
          {activeSprint && (
            <SprintBox
              type="active"
              sprint={activeSprint}
              tasks={backlogTasks.filter(t => t.sprintId === activeSprint.id)}
              boardId={boardId}
              boardColumns={board.columns}
              users={users}
              onComplete={() => setCompletingSprint(activeSprint)}
              onAdd={addTask}
            />
          )}

          {/* Спринты в планировании */}
          {planningSprints.map(sp => (
            <SprintBox
              key={sp.id}
              type="planning"
              sprint={sp}
              tasks={backlogTasks.filter(t => t.sprintId === sp.id)}
              boardId={boardId}
              boardColumns={board.columns}
              users={users}
              onStart={() => startSprint(sp.id)}
              onAdd={addTask}
            />
          ))}

          {/* Форма создания */}
          {creatingSprint && (
            <CreateSprintForm boardId={boardId} onClose={() => setCreatingSprint(false)} />
          )}

          {/* Бэклог */}
          {(!sprintLoading || data) && (
            <SprintBox
              type="backlog"
              sprint={null}
              tasks={backlogTasks.filter(t => !t.sprintId)}
              boardId={boardId}
              boardColumns={board.columns}
              users={users}
              onCreateSprint={() => setCreatingSprint(true)}
              onAdd={addTask}
            />
          )}

          <DragOverlay>
            {activeDragTask ? (
              <TaskRow
                task={activeDragTask}
                users={users}
                boardColumns={board.columns}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Завершённые */}
        <CompletedSprints sprints={sprints} />
      </div>

      {completingSprint && (
        <ConfirmDialog
          title={`Завершить «${completingSprint.name}»?`}
          message={`Выполнено: ${completingSprint.completedTasks} из ${completingSprint.totalTasks}. Незавершённые задачи вернутся в бэклог.`}
          confirmLabel="Завершить спринт"
          onConfirm={async () => {
            await completeSprint(completingSprint.id)
            setCompletingSprint(null)
          }}
          onCancel={() => setCompletingSprint(null)}
        />
      )}
    </div>
  )
}
