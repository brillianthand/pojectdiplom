import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, ListChecks, Star, Plus, Trash2, CalendarDays } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PriorityIcon } from '../ui/PriorityIcon'
import { isOverdue, formatDateRelative as fmtDate } from '../../utils/date'

function pad2(n) { return String(n).padStart(2, '0') }

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return d.getTime() === now.getTime()
}

function KpiCell({ label, value, border }) {
  return (
    <div className={`flex flex-col gap-2 px-6 py-5 ${border ? 'hairline-l' : ''}`}>
      <span className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">{label}</span>
      <span className="text-3xl font-display-tight text-fg-primary tabular-nums leading-none">{value}</span>
    </div>
  )
}

function CompletionButton({ completed, onClick }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      onPointerDown={e => e.stopPropagation()}
      title={completed ? 'Вернуть в работу' : 'Завершить'}
      className={`group/chk flex-shrink-0 flex w-[18px] h-[18px] rounded-full items-center justify-center transition-all duration-150 ${
        completed
          ? 'bg-success'
          : 'border-[1.5px] border-fg-subtle hover:border-success'
      }`}
    >
      <Check
        size={9}
        strokeWidth={3}
        className={`transition-opacity duration-150 ${
          completed ? 'text-white opacity-100' : 'text-success opacity-0 group-hover/chk:opacity-60'
        }`}
      />
    </button>
  )
}

function DateLabel({ dateStr, completed }) {
  if (!dateStr) return <span className="text-xs font-mono text-fg-subtle">—</span>
  const label = fmtDate(dateStr)
  const overdue = !completed && isOverdue(dateStr)
  const today = !completed && isToday(dateStr)
  return (
    <span className={`text-xs font-mono tabular-nums whitespace-nowrap ${
      overdue ? 'text-danger' : today ? 'text-fg-primary font-medium' : 'text-fg-muted'
    }`}>
      {label}
    </span>
  )
}

function EmptyState({ text = 'Нет назначенных задач', sub = 'Задачи появятся, когда вас назначат исполнителем' }) {
  return (
    <div className="flex flex-col items-center gap-4 mt-24 text-fg-subtle">
      <div className="w-14 h-14 rounded-2xl bg-surface-3 flex items-center justify-center">
        <ListChecks size={22} strokeWidth={1.5} className="text-fg-muted" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-fg-primary mb-1">{text}</p>
        <p className="text-xs font-mono text-fg-muted uppercase tracking-[0.12em]">{sub}</p>
      </div>
    </div>
  )
}

const COL = '24px 1fr 140px 100px'

function TaskRow({ task, onOpen, onToggle }) {
  return (
    <div
      onClick={onOpen}
      className="group grid items-center gap-x-4 pl-5 pr-5 py-3 hairline-b cursor-pointer hover:bg-surface-3/30 transition-colors"
      style={{ gridTemplateColumns: COL }}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <CompletionButton completed={task.completed} onClick={onToggle} />
      </div>

      {/* Title + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <span className={`text-sm leading-snug block truncate ${
            task.completed ? 'line-through text-fg-muted' : 'text-fg-primary'
          }`}>
            {task.title}
          </span>
          <p className="text-[11px] font-mono truncate mt-0.5">
            <span className="text-fg-muted">Проект </span>
            <span className="text-fg-primary">{task._projectName}</span>
            {task._boardName && <>
              <span className="text-fg-muted"> Доска </span>
              <span className="text-fg-primary">{task._boardName}</span>
            </>}
          </p>
        </div>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-1.5 min-w-0">
        {task.priority && task.priority !== 'none' ? (
          <>
            <PriorityIcon priority={task.priority} size={12} />
            <span className="text-xs font-mono text-fg-secondary truncate">
              {task.priority === 'urgent' ? 'Срочно' : task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
            </span>
          </>
        ) : (
          <span className="text-xs font-mono text-fg-subtle">—</span>
        )}
      </div>

      {/* Due date */}
      <div className="flex justify-end">
        <DateLabel dateStr={task.dueDate} completed={task.completed} />
      </div>
    </div>
  )
}

function Section({ label, count, tasks, defaultOpen = true, onOpen, onToggle, accentColor }) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-surface-3/20 transition-colors"
      >
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
        <span className="text-xs uppercase tracking-wider font-medium text-fg-primary">{label}</span>
        <span
          className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${accentColor}1a`, color: accentColor }}
        >
          {count}
        </span>
        <ChevronRight
          size={11}
          strokeWidth={2.5}
          className={`ml-auto text-fg-subtle transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onOpen={() => onOpen(task)}
          onToggle={() => onToggle(task.id, task._boardId)}
        />
      ))}
    </div>
  )
}

const TABS = [
  { key: 'my',       label: 'Мои задачи' },
  { key: 'personal', label: 'Личные' },
  { key: 'starred',  label: 'Избранное' },
]

const FILTERS = [
  { key: 'all',     label: 'Все' },
  { key: 'today',   label: 'Сегодня' },
  { key: 'week',    label: 'Неделя' },
  { key: 'overdue', label: 'Просрочено' },
]

// Personal rows share the page grid so they line up with the column headers
// above them — same rhythm as the «Мои задачи» / «Избранное» tabs.
const PCOL = '24px 1fr 132px 32px'

function PersonalAddBar({ onAdd }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return
    onAdd({ title: t, dueDate: due || null })
    setTitle('')
    setDue('')
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg bg-surface-2 hairline px-4 py-2.5 transition-colors focus-within:border-line-accent">
      <span className="flex-shrink-0 grid place-items-center w-[18px] h-[18px] rounded-full border-[1.5px] border-dashed border-fg-subtle text-fg-subtle transition-colors group-focus-within:border-fg-primary group-focus-within:text-fg-primary">
        <Plus size={11} strokeWidth={2.5} />
      </span>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Новая личная задача…"
        className="flex-1 min-w-0 bg-transparent text-sm text-fg-primary placeholder:text-fg-subtle outline-none"
      />
      <label className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 cursor-pointer transition-colors ${
        due ? 'text-fg-primary bg-surface-3' : 'text-fg-subtle hover:bg-surface-3'
      }`}>
        <CalendarDays size={13} strokeWidth={2} />
        <span className="text-2xs font-mono uppercase tracking-[0.08em] tabular-nums">{due ? fmtDate(due) : 'Срок'}</span>
        <input
          type="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button
        onClick={submit}
        disabled={!title.trim()}
        className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-2xs font-mono uppercase tracking-[0.14em] text-white transition-all hover:bg-accent-hover disabled:opacity-20 disabled:pointer-events-none"
      >
        Добавить
      </button>
    </div>
  )
}

// Mirrors DateLabel from the main tab, but the whole label opens a date picker.
function PersonalDueControl({ task, onUpdate }) {
  const has = !!task.dueDate
  const overdue = !task.completed && has && isOverdue(task.dueDate)
  const today   = !task.completed && has && isToday(task.dueDate)

  return (
    <label className="relative cursor-pointer">
      <input
        type="date"
        value={task.dueDate || ''}
        onChange={e => onUpdate(task.id, { dueDate: e.target.value || '' })}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
      />
      {has ? (
        <span className={`text-xs font-mono tabular-nums whitespace-nowrap ${
          overdue ? 'text-danger' : today ? 'text-fg-primary font-medium' : 'text-fg-muted'
        }`}>
          {fmtDate(task.dueDate)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-fg-subtle whitespace-nowrap opacity-0 group-hover:opacity-100 hover:text-fg-muted transition-opacity">
          <CalendarDays size={11} strokeWidth={2} /> Срок
        </span>
      )}
    </label>
  )
}

function PersonalRow({ task, onToggle, onUpdate, onDelete }) {
  const [open, setOpen]   = useState(false)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes || '')

  // Seed the draft from the latest task each time the editor opens.
  const toggle = () => {
    if (!open) { setTitle(task.title); setNotes(task.notes || '') }
    setOpen(o => !o)
  }

  const dirty = title.trim() !== task.title || notes.trim() !== (task.notes || '')

  const save = () => {
    const t = title.trim()
    if (!t) return
    const changes = {}
    if (t !== task.title) changes.title = t
    if (notes.trim() !== (task.notes || '')) changes.notes = notes.trim()
    if (Object.keys(changes).length) onUpdate(task.id, changes)
    setOpen(false)
  }

  const cancel = () => {
    setTitle(task.title)
    setNotes(task.notes || '')
    setOpen(false)
  }

  return (
    <div className="hairline-b">
      {/* Collapsed row */}
      <div
        className="group grid items-center gap-x-4 pl-5 pr-5 py-3 transition-colors hover:bg-surface-3/30"
        style={{ gridTemplateColumns: PCOL }}
      >
        {/* Checkbox */}
        <div className="flex items-center justify-center">
          <CompletionButton completed={task.completed} onClick={() => onToggle(task.id)} />
        </div>

        {/* Title — click to open the editor */}
        <button onClick={toggle} className="min-w-0 text-left">
          <span className={`block truncate text-sm leading-snug transition-colors ${
            task.completed ? 'line-through text-fg-muted' : 'text-fg-primary'
          }`}>
            {task.title}
          </span>
          {task.notes && (
            <span className="block truncate text-[11px] font-mono text-fg-muted mt-0.5">{task.notes}</span>
          )}
        </button>

        {/* Due date */}
        <div className="flex justify-end">
          <PersonalDueControl task={task} onUpdate={onUpdate} />
        </div>

        {/* Expand chevron */}
        <div className="flex justify-end">
          <button
            onClick={toggle}
            title={open ? 'Свернуть' : 'Изменить'}
            className="grid place-items-center w-7 h-7 rounded-md text-fg-subtle hover:text-fg-primary hover:bg-surface-3 transition"
          >
            <ChevronRight size={14} strokeWidth={2.5} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inline editor — rename, notes, delete */}
      {open && (
        <div className="px-5 pb-4 pt-1 animate-fade-in">
          <div className="rounded-xl bg-surface-2 hairline-strong shadow-sm overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-2xs font-mono uppercase tracking-[0.16em] text-fg-muted">Название</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') cancel()
                    if (e.key === 'Enter') save()
                  }}
                  placeholder="Название задачи"
                  className="w-full rounded-lg border border-transparent bg-surface-3 px-3 py-2.5 text-sm text-fg-primary placeholder:text-fg-subtle outline-none transition-colors focus:border-line-accent focus:bg-surface-2"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-2xs font-mono uppercase tracking-[0.16em] text-fg-muted">Заметки</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') cancel()
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
                  }}
                  rows={4}
                  placeholder="Добавьте заметку по задаче…"
                  className="w-full resize-none rounded-lg border border-transparent bg-surface-3 px-3 py-2.5 text-sm leading-relaxed text-fg-primary placeholder:text-fg-subtle outline-none transition-colors focus:border-line-accent focus:bg-surface-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-3 hairline-t bg-surface-1">
              <button
                onClick={() => onDelete(task.id)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-2xs font-mono uppercase tracking-[0.12em] text-fg-muted transition-colors hover:text-danger hover:bg-danger-soft"
              >
                <Trash2 size={13} strokeWidth={2} /> Удалить
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={cancel}
                  className="rounded-md px-3.5 py-2 text-2xs font-mono uppercase tracking-[0.12em] text-fg-secondary transition-colors hover:bg-surface-3"
                >
                  Отмена
                </button>
                <button
                  onClick={save}
                  disabled={!title.trim() || !dirty}
                  className="rounded-md bg-accent px-4 py-2 text-2xs font-mono uppercase tracking-[0.12em] text-white transition-all hover:bg-accent-hover disabled:opacity-25 disabled:pointer-events-none"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Same accent-dot section header used by the other tabs (see Section above).
function PersonalSection({ label, count, accentColor, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-surface-3/20 transition-colors"
      >
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
        <span className="text-xs uppercase tracking-wider font-medium text-fg-primary">{label}</span>
        <span
          className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${accentColor}1a`, color: accentColor }}
        >
          {count}
        </span>
        <ChevronRight
          size={11}
          strokeWidth={2.5}
          className={`ml-auto text-fg-subtle transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && children}
    </div>
  )
}

function PersonalPanel() {
  const {
    personalTasks, personalTasksLoading, loadPersonalTasks,
    addPersonalTask, updatePersonalTask, togglePersonalTask, deletePersonalTask,
  } = useStore()

  const [filter, setFilter] = useState('all')

  useEffect(() => { loadPersonalTasks() }, [])

  const total = personalTasks.length

  const groups = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
    const g = { overdue: [], dated: [], noDate: [], done: [], todayList: [], weekList: [] }

    for (const t of personalTasks) {
      if (t.completed) { g.done.push(t); continue }

      if (!t.dueDate)              g.noDate.push(t)
      else if (isOverdue(t.dueDate)) g.overdue.push(t)
      else                          g.dated.push(t)

      if (t.dueDate) {
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0)
        if (d.getTime() === today.getTime())  g.todayList.push(t)
        if (d >= today && d <= weekEnd)        g.weekList.push(t)
      }
    }

    const byDate = (a, b) => (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1
    g.overdue.sort(byDate); g.dated.sort(byDate); g.todayList.sort(byDate); g.weekList.sort(byDate)
    return g
  }, [personalTasks])

  const { overdue, dated, noDate, done, todayList, weekList } = groups

  const counts = {
    all:     overdue.length + dated.length + noDate.length,
    today:   todayList.length,
    week:    weekList.length,
    overdue: overdue.length,
  }

  const renderRows = tasks => tasks.map(task => (
    <PersonalRow
      key={task.id}
      task={task}
      onToggle={togglePersonalTask}
      onUpdate={updatePersonalTask}
      onDelete={deletePersonalTask}
    />
  ))

  const FilteredEmpty = () => (
    <div className="flex flex-col items-center gap-3 mt-16 text-fg-subtle">
      <div className="w-12 h-12 rounded-2xl bg-surface-3 flex items-center justify-center">
        <ListChecks size={20} strokeWidth={1.5} className="text-fg-muted" />
      </div>
      <p className="text-xs font-mono text-fg-muted uppercase tracking-[0.12em]">Нет задач в этом разделе</p>
    </div>
  )

  return (
    <div className="pb-20">
      {/* Quick add */}
      <div className="px-8 pb-5">
        <PersonalAddBar onAdd={addPersonalTask} />
      </div>

      {total === 0 ? (
        personalTasksLoading ? null : (
          <div className="flex flex-col items-center gap-4 mt-16 text-fg-subtle">
            <div className="w-14 h-14 rounded-2xl bg-surface-3 flex items-center justify-center">
              <ListChecks size={22} strokeWidth={1.5} className="text-fg-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-fg-primary mb-1">Здесь пока пусто</p>
              <p className="text-xs font-mono text-fg-muted uppercase tracking-[0.12em]">Приватный список — его не видят участники проектов</p>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Date filter — same treatment as the «Мои задачи» tab */}
          <div className="flex items-center gap-1 px-8 pb-4 hairline-b">
            {FILTERS.map(f => {
              const isActive = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-[0.14em] transition-all ${
                    isActive ? 'bg-accent text-white' : 'text-fg-primary hover:bg-surface-3/60'
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums ${isActive ? 'text-white/60' : 'text-fg-primary'}`}>
                    {counts[f.key]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Column headers — aligned with PCOL */}
          <div
            className="grid items-center gap-x-4 pl-5 pr-5 py-2 hairline-b bg-surface-1"
            style={{ gridTemplateColumns: PCOL }}
          >
            <span />
            <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">Задача</span>
            <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary text-right">Срок</span>
            <span />
          </div>

          {filter === 'all' ? (
            <>
              <PersonalSection label="Просрочено" count={overdue.length} accentColor="#DC2626">{renderRows(overdue)}</PersonalSection>
              <PersonalSection label="Активные"   count={dated.length}   accentColor="#3b82f6">{renderRows(dated)}</PersonalSection>
              <PersonalSection label="Без срока"  count={noDate.length}  accentColor="#94a3b8">{renderRows(noDate)}</PersonalSection>
              <PersonalSection label="Выполнено"  count={done.length}    accentColor="#16A34A" defaultOpen={false}>{renderRows(done)}</PersonalSection>
            </>
          ) : (() => {
            const map = {
              today:   { label: 'Сегодня',   tasks: todayList, accentColor: '#D97706' },
              week:    { label: 'На неделе',  tasks: weekList,  accentColor: '#3b82f6' },
              overdue: { label: 'Просрочено', tasks: overdue,   accentColor: '#DC2626' },
            }
            const cfg = map[filter]
            if (cfg.tasks.length === 0) return <FilteredEmpty />
            return <PersonalSection label={cfg.label} count={cfg.tasks.length} accentColor={cfg.accentColor}>{renderRows(cfg.tasks)}</PersonalSection>
          })()}
        </>
      )}
    </div>
  )
}

export function MyTasksView() {
  const {
    boards, projects, currentUser, starredIds,
    loadAllBoardsAcrossProjects, setActiveBoard, setActiveTask, setView, toggleTaskComplete,
  } = useStore()

  // Persist the active tab so a page reload keeps you on «Личные» / «Избранное»
  // instead of always snapping back to «Мои задачи».
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem('kanban_mytasks_tab')
    return TABS.some(t => t.key === saved) ? saved : 'my'
  })
  const [filter, setFilter] = useState('all')

  const selectTab = (key) => {
    setTab(key)
    localStorage.setItem('kanban_mytasks_tab', key)
  }

  useEffect(() => {
    loadAllBoardsAcrossProjects()
  }, [projects.length])

  const groups = useMemo(() => {
    const empty = { overdue: [], active: [], noDate: [], done: [], todayList: [], weekList: [], starredList: [] }
    if (!currentUser) return empty

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)

    const res = { overdue: [], active: [], noDate: [], done: [], todayList: [], weekList: [], starredList: [] }

    for (const project of projects) {
      for (const board of project.boards) {
        const b = boards[board.id]
        if (!b) continue
        for (const tasks of Object.values(b.tasks)) {
          for (const task of tasks) {
            const entry = {
              ...task,
              _projectName: project.name,
              _projectColor: project.color,
              _boardId: board.id,
              _boardName: board.name,
            }

            // Favorites are personal — not restricted to assignees.
            if (starredIds.has(task.id)) res.starredList.push(entry)

            if (!task.assignees?.includes(currentUser.id)) continue
            if (task.completed) { res.done.push(entry); continue }

            if (!task.dueDate) {
              res.noDate.push(entry)
            } else if (isOverdue(task.dueDate)) {
              res.overdue.push(entry)
            } else {
              res.active.push(entry)
            }

            if (task.dueDate) {
              const d = new Date(task.dueDate); d.setHours(0, 0, 0, 0)
              if (d.getTime() === today.getTime()) res.todayList.push(entry)
              if (d >= today && d <= weekEnd) res.weekList.push(entry)
            }
          }
        }
      }
    }

    const byDate = (a, b) => (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1
    res.overdue.sort(byDate)
    res.active.sort(byDate)
    res.todayList.sort(byDate)
    res.weekList.sort(byDate)

    return res
  }, [boards, projects, currentUser, starredIds])

  const { overdue, active, noDate, done, todayList, weekList, starredList } = groups

  const counts = {
    all: overdue.length + active.length + noDate.length,
    today: todayList.length,
    week: weekList.length,
    overdue: overdue.length,
  }

  const hasAnything = counts.all > 0 || done.length > 0 || counts.starred > 0

  const openTask = (task) => {
    setActiveBoard(task._boardId)
    setView('board')
    setActiveTask(task.id)
  }

  const toggle = (id, boardId) => toggleTaskComplete(id, boardId)
  return (
    <div className="flex-1 overflow-y-auto bg-surface-1">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted mb-1.5">Рабочее пространство</p>
        <h1 className="text-4xl font-display-tight text-fg-primary leading-[0.95]">Мои задачи</h1>
        <div className="flex items-center gap-1 mt-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-mono uppercase tracking-[0.14em] transition-all ${
                tab === t.key
                  ? 'bg-accent text-white'
                  : 'text-fg-primary hover:bg-surface-3/60'
              }`}
            >
              {t.key === 'starred' && <Star size={11} strokeWidth={1.75} className={tab === t.key ? 'fill-white' : 'fill-warning text-warning'} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip — только для Мои задачи */}
      {tab === 'my' && hasAnything && (
        <div className="grid grid-cols-4 hairline-t hairline-b mx-8 mb-6">
          <KpiCell label="Просрочено" value={overdue.length} />
          <KpiCell label="Сегодня"    value={todayList.length}              border />
          <KpiCell label="Активных"   value={active.length + noDate.length} border />
          <KpiCell label="Выполнено"  value={done.length}                   border />
        </div>
      )}

      {/* Filter tabs — только для Мои задачи */}
      {tab === 'my' && (
        <div className="flex items-center gap-1 px-8 pb-4 hairline-b">
          {FILTERS.map(f => {
            const isActive = filter === f.key
            const n = counts[f.key]
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-mono uppercase tracking-[0.14em] transition-all ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-fg-primary hover:bg-surface-3/60'
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${isActive ? 'text-white/60' : 'text-fg-primary'}`}>
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Column headers */}
      {((tab === 'my' && hasAnything) || (tab === 'starred' && starredList.length > 0)) && (
        <div
          className="grid items-center gap-x-4 pl-5 pr-5 py-2 hairline-b bg-surface-1"
          style={{ gridTemplateColumns: COL }}
        >
          <span />
          <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">Задача</span>
          <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">Приоритет</span>
          <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary text-right">Срок</span>
        </div>
      )}

      {/* Content */}
      <div className="pt-2">
        {tab === 'personal' ? (
          <PersonalPanel />
        ) : tab === 'starred' ? (
          starredList.length === 0
            ? <EmptyState text="Нет избранных задач" sub="Нажмите на звезду в задаче, чтобы добавить её сюда" />
            : <Section key="starred" label="Избранное" count={starredList.length} tasks={starredList} accentColor="#D97706" onOpen={openTask} onToggle={toggle} />
        ) : !hasAnything ? (
          <EmptyState />
        ) : filter === 'all' ? (
          <>
            <Section key="overdue" label="Просрочено"  count={overdue.length} tasks={overdue} accentColor="#DC2626" onOpen={openTask} onToggle={toggle} />
            <Section key="active"  label="Активные"    count={active.length}  tasks={active}  accentColor="#3b82f6" onOpen={openTask} onToggle={toggle} />
            <Section key="noDate"  label="Без срока"   count={noDate.length}  tasks={noDate}  accentColor="#94a3b8" onOpen={openTask} onToggle={toggle} />
            <Section key="done"    label="Завершённые" count={done.length}    tasks={done}    accentColor="#16A34A" onOpen={openTask} onToggle={toggle} />
          </>
        ) : (() => {
          const map = {
            today:   { label: 'Сегодня',   tasks: todayList, accentColor: '#D97706' },
            week:    { label: 'На неделе', tasks: weekList,  accentColor: '#3b82f6' },
            overdue: { label: 'Просрочено', tasks: overdue,  accentColor: '#DC2626' },
          }
          const cfg = map[filter]
          if (cfg.tasks.length === 0) return <EmptyState text="Пусто в этом разделе" sub="Задачи этой категории не найдены" />
          return <Section label={cfg.label} count={cfg.tasks.length} tasks={cfg.tasks} accentColor={cfg.accentColor} onOpen={openTask} onToggle={toggle} />
        })()}
      </div>
    </div>
  )
}
