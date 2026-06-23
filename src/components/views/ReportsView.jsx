import { useEffect, useMemo, useState } from 'react'
import { BarChart2, AlertTriangle, CheckCircle2, Users, ChevronDown } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'
import { PriorityIcon } from '../ui/PriorityIcon'
import { isOverdue } from '../../utils/date'

// ─── helpers ──────────────────────────────────────────────────────────────────

const PRIORITIES_META = [
  { value: 'urgent', label: 'Срочно',  color: '#E5484D' },
  { value: 'high',   label: 'Высокий', color: '#F5A524' },
  { value: 'medium', label: 'Средний', color: '#5E6AD2' },
  { value: 'low',    label: 'Низкий',  color: '#16A34A' },
  { value: 'none',   label: 'Без',     color: 'rgba(26,26,24,0.32)' },
]

const TABS = [
  { key: 'overview', label: 'Общая' },
  { key: 'members',  label: 'Задачи сотрудников' },
]

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function pluralRu(n, [one, few, many]) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
function fmtDueLabel(dateStr) {
  if (!dateStr) return '—'
  const d = startOfDay(dateStr)
  const today = startOfDay(new Date())
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Вчера'
  if (diff < 0) return `${Math.abs(diff)} дн. назад`
  if (diff < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// ─── primitives ───────────────────────────────────────────────────────────────

function TabsNav({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {TABS.map(t => {
        const active = value === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-mono uppercase tracking-[0.14em] transition-all ${
              active
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-fg-primary hover:bg-surface-3/60 hover:text-fg-primary'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function KpiCard({ label, value, border }) {
  return (
    <div className={`flex flex-col gap-2 px-6 py-5 flex-1 ${border ? 'hairline-l' : ''}`}>
      <span className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">{label}</span>
      <span className="text-3xl font-display-tight text-fg-primary tabular-nums leading-none">{value}</span>
    </div>
  )
}

function SectionHead({ label, meta, action }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hairline-b">
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-fg-primary">{label}</span>
        {meta && <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-fg-subtle tabular-nums">{meta}</span>}
      </div>
      {action}
    </div>
  )
}

// ─── donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ segments, total }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const gap = 4

  if (total === 0) {
    return (
      <div className="relative w-[120px] h-[120px] flex-shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth="10" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-display-tight text-fg-primary tabular-nums leading-none">0</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-fg-muted mt-1">задач</span>
        </div>
      </div>
    )
  }

  let acc = 0
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const frac = s.value / total
    const len = Math.max(0, frac * circ - gap)
    const off = acc
    acc += frac * circ
    return { color: s.color, len, off }
  })

  return (
    <div className="relative w-[120px] h-[120px] flex-shrink-0">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <g transform="rotate(-90 60 60)">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="10" />
          {arcs.map((a, i) => (
            <circle key={i} cx="60" cy="60" r={r} fill="none"
              stroke={a.color} strokeWidth="10"
              strokeDasharray={`${a.len} ${circ}`}
              strokeDashoffset={-a.off}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display-tight text-fg-primary tabular-nums leading-none">{total}</span>
        <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-fg-muted mt-1">задач</span>
      </div>
    </div>
  )
}

// ─── horizontal bar row ───────────────────────────────────────────────────────

function HBarRow({ label, value, total, color, icon, isLast }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className={`px-5 py-3 ${!isLast ? 'hairline-b' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-sm text-fg-primary truncate">{label}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-mono text-fg-muted tabular-nums">{value}</span>
          <span className="text-xs font-mono text-fg-secondary tabular-nums w-9 text-right">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="h-[3px] bg-surface-3 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ─── board progress row ───────────────────────────────────────────────────────

function BoardRow({ name, done, overdue, total, isLast }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={`px-5 py-3.5 ${!isLast ? 'hairline-b' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-fg-primary truncate">{name}</span>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {overdue > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-danger tabular-nums">
              <AlertTriangle size={10} strokeWidth={2.2} />
              {overdue} просроч.
            </span>
          )}
          <span className="text-xs font-mono text-fg-muted tabular-nums">{done} / {total}</span>
          <span className="text-xs font-mono text-fg-primary font-medium tabular-nums w-9 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: 'var(--color-success)' }}
        />
      </div>
    </div>
  )
}

// ─── team workload row ────────────────────────────────────────────────────────

function MemberWorkloadRow({ member, done, overdue, total, isLast }) {
  // Bar shows the member's completion (% done); overdue surfaces separately as a red flag.
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${!isLast ? 'hairline-b' : ''}`}>
      <Avatar initials={member.initials} color={member.color} avatarUrl={member.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-fg-primary truncate">{member.name}</span>
          <div className="flex items-center gap-3 ml-3 flex-shrink-0">
            {overdue > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-danger tabular-nums">
                <AlertTriangle size={10} strokeWidth={2.2} />
                {overdue} просроч.
              </span>
            )}
            <span className="text-xs font-mono text-fg-muted tabular-nums">
              {done} <span className="text-fg-subtle">/ {total}</span>
            </span>
            <span className="text-xs font-mono text-fg-primary font-medium tabular-nums w-9 text-right">{pct}%</span>
          </div>
        </div>
        <div className="h-[5px] w-full bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: 'var(--color-success)' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── member tasks card (Members tab) ──────────────────────────────────────────

function MemberTaskRow({ task, onOpen, isLast }) {
  const taskOverdue = !task.completed && isOverdue(task.dueDate)
  return (
    <button
      onClick={() => onOpen(task)}
      className={`group/row w-full grid items-center gap-4 pl-8 pr-7 py-3.5 text-left hover:bg-surface-3/40 transition-colors ${!isLast ? 'hairline-b' : ''}`}
      style={{ gridTemplateColumns: '1fr auto' }}
    >
      <div className="min-w-0">
        <span className={`block text-[15px] leading-snug truncate transition-colors ${
          task.completed
            ? 'line-through text-fg-muted'
            : 'text-fg-primary group-hover/row:text-fg-primary'
        }`}>
          {task.title}
        </span>
        <span className="block text-xs font-mono text-fg-subtle truncate mt-1">
          {task._boardName}
        </span>
      </div>
      <span className={`text-xs font-mono tabular-nums whitespace-nowrap text-right min-w-[90px] ${
        taskOverdue ? 'text-danger font-medium' : 'text-fg-muted'
      }`}>
        {fmtDueLabel(task.dueDate)}
      </span>
    </button>
  )
}


function MemberTasksCard({ member, tasks, done, active, overdue, onOpen }) {
  const [open, setOpen] = useState(true)
  const total = tasks.length

  const { current, completed } = useMemo(() => {
    const byDue = (a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      return da - db
    }
    return {
      current: tasks
        .filter(t => !t.completed)
        .sort((a, b) => {
          const oa = isOverdue(a.dueDate) ? 0 : 1
          const ob = isOverdue(b.dueDate) ? 0 : 1
          if (oa !== ob) return oa - ob
          return byDue(a, b)
        }),
      completed: tasks.filter(t => t.completed).sort(byDue),
    }
  }, [tasks])

  return (
    <div className="bg-surface-2 hairline-strong rounded-md overflow-hidden shadow-[0_1px_2px_rgba(17,17,16,0.04)] flex flex-col">
      {/* Header — кликабельный */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-3/20 transition-colors"
      >
        <Avatar initials={member.initials} color={member.color} avatarUrl={member.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-fg-primary leading-none truncate">{member.name}</span>
          <span className="block text-[11px] font-mono text-fg-subtle truncate mt-1">{member.email}</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex flex-col items-end leading-none">
            <span className="text-base font-display-tight text-fg-primary tabular-nums">{active}</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-fg-muted mt-1">В работе</span>
          </div>
          <div className="flex flex-col items-end leading-none">
            <span className="text-base font-display-tight text-fg-primary tabular-nums">{done}</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-fg-muted mt-1">Готово</span>
          </div>
          <div className={`flex items-center justify-center w-6 h-6 rounded-full bg-surface-3/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <ChevronDown size={12} strokeWidth={2} className="text-fg-secondary" />
          </div>
        </div>
      </button>

      {/* Task list */}
      {open && (
        <div className="hairline-t flex-1">
          {total === 0 ? (
            <div className="px-5 py-6 text-xs font-mono text-fg-muted text-center">Нет задач</div>
          ) : (
            <>
              {current.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-5 py-2.5 hairline-b bg-surface-3/30">
                    <span className="text-xs font-semibold text-fg-primary">Текущие</span>
                    <span className="text-xs font-mono text-fg-secondary tabular-nums">{current.length}</span>
                  </div>
                  {current.map((t, i) => (
                    <MemberTaskRow key={t.id} task={t} onOpen={onOpen} isLast={i === current.length - 1 && completed.length === 0} />
                  ))}
                </>
              )}
              {completed.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-5 py-2.5 hairline-b bg-surface-3/30 hairline-t">
                    <span className="text-xs font-semibold text-fg-primary">Выполненные</span>
                    <span className="text-xs font-mono text-fg-secondary tabular-nums">{completed.length}</span>
                  </div>
                  {completed.map((t, i) => (
                    <MemberTaskRow key={t.id} task={t} onOpen={onOpen} isLast={i === completed.length - 1} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── task row (overdue / upcoming tables) ─────────────────────────────────────

function TaskTableRow({ task, members, isLast, onOpen, danger }) {
  const assignees = (task.assignees ?? []).map(id => members.find(m => m.id === id)).filter(Boolean)
  return (
    <button
      onClick={onOpen}
      className={`w-full grid items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-3/40 transition-colors ${!isLast ? 'hairline-b' : ''}`}
      style={{ gridTemplateColumns: '1fr auto auto' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {task.priority && task.priority !== 'none' && (
            <PriorityIcon priority={task.priority} size={11} />
          )}
          <span className="text-sm text-fg-primary truncate">{task.title}</span>
        </div>
        <span className="block text-[11px] font-mono text-fg-subtle truncate mt-0.5">
          {task._boardName}
        </span>
      </div>
      <div className="flex items-center -space-x-1.5">
        {assignees.slice(0, 3).map(m => (
          <Avatar key={m.id} initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="xs" />
        ))}
        {assignees.length === 0 && <span className="text-[11px] font-mono text-fg-subtle">—</span>}
        {assignees.length > 3 && (
          <span className="text-[10px] font-mono text-fg-muted ml-1.5">+{assignees.length - 3}</span>
        )}
      </div>
      <span className={`text-xs font-mono tabular-nums whitespace-nowrap text-right min-w-[80px] ${
        danger ? 'text-danger font-medium' : 'text-fg-muted'
      }`}>
        {fmtDueLabel(task.dueDate)}
      </span>
    </button>
  )
}

// ─── empty / placeholder ──────────────────────────────────────────────────────

function EmptyHint({ children }) {
  return <div className="px-5 py-8 text-xs font-mono text-fg-muted text-center">{children}</div>
}

// ─── main view ────────────────────────────────────────────────────────────────

export function ReportsView() {
  const {
    boards, activeProjectId, projects, members,
    loadAllProjectBoards, setActiveBoard, setActiveTask, setView,
  } = useStore()

  const [tab, setTab] = useState('overview')

  const project = projects.find(p => p.id === activeProjectId)
  const projectMembers = members[activeProjectId] ?? []

  useEffect(() => {
    loadAllProjectBoards()
  }, [activeProjectId])

  const stats = useMemo(() => {
    if (!project) return null

    // Collect every task across project's boards
    const allTasks = []
    const boardSummaries = []

    for (const boardRef of project.boards) {
      const b = boards[boardRef.id]
      if (!b) continue
      let bTotal = 0, bDone = 0, bActive = 0, bOverdue = 0
      for (const tasks of Object.values(b.tasks)) {
        for (const t of tasks) {
          allTasks.push({ ...t, _boardId: boardRef.id, _boardName: boardRef.name })
          bTotal++
          if (t.completed) bDone++
          else if (isOverdue(t.dueDate)) { bOverdue++; bActive++ }
          else bActive++
        }
      }
      boardSummaries.push({
        id: boardRef.id, name: boardRef.name,
        total: bTotal, done: bDone, active: bActive - bOverdue, overdue: bOverdue,
      })
    }

    // Global KPI
    const totalTasks   = allTasks.length
    const doneTasks    = allTasks.filter(t => t.completed).length
    const overdueTasks = allTasks.filter(t => !t.completed && isOverdue(t.dueDate)).length
    const activeTasks  = totalTasks - doneTasks - overdueTasks

    // Priority breakdown (all tasks)
    const priorityCounts = Object.fromEntries(PRIORITIES_META.map(p => [p.value, 0]))
    for (const t of allTasks) {
      const key = t.priority && priorityCounts[t.priority] !== undefined ? t.priority : 'none'
      priorityCounts[key]++
    }

    // Team workload + per-member task lists
    const byAssignee = projectMembers.map(m => {
      const tasksForMember = allTasks.filter(t => (t.assignees ?? []).includes(m.id))
      const done    = tasksForMember.filter(t => t.completed).length
      const overdue = tasksForMember.filter(t => !t.completed && isOverdue(t.dueDate)).length
      const active  = tasksForMember.length - done - overdue
      return { member: m, tasks: tasksForMember, total: tasksForMember.length, done, active, overdue }
    }).sort((a, b) => b.total - a.total)
    const maxMemberTotal = Math.max(1, ...byAssignee.map(x => x.total))

    const overdueList = allTasks
      .filter(t => !t.completed && isOverdue(t.dueDate))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 12)

    return {
      totalTasks, doneTasks, activeTasks, overdueTasks,
      boardSummaries, priorityCounts,
      byAssignee, maxMemberTotal,
      overdueList,
    }
  }, [boards, activeProjectId, projects, projectMembers])

  const openTask = (task) => {
    if (project?.activeBoardId !== task._boardId) {
      setActiveBoard(task._boardId)
    }
    setView('board')
    setActiveTask(task.id)
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart2 size={28} className="text-fg-subtle" strokeWidth={1.5} />
          <p className="text-sm text-fg-muted">Выберите проект для отчёта</p>
        </div>
      </div>
    )
  }

  const {
    totalTasks, doneTasks, activeTasks, overdueTasks,
    boardSummaries, priorityCounts,
    byAssignee, maxMemberTotal,
    overdueList,
  } = stats ?? {
    totalTasks: 0, doneTasks: 0, activeTasks: 0, overdueTasks: 0,
    boardSummaries: [], priorityCounts: {},
    byAssignee: [], maxMemberTotal: 1,
    overdueList: [],
  }

  const noData = totalTasks === 0

  return (
    <div className="h-full overflow-y-auto animate-fade-in bg-surface-1">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="px-7 pt-7 pb-4">
        <h1 className="text-4xl font-display-tight text-fg-primary leading-[0.95]">Отчёты</h1>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="px-7 pb-4 hairline-b">
        <TabsNav value={tab} onChange={setTab} />
      </div>

      {tab === 'overview' ? (
        <>
          {/* ── KPI strip ─────────────────────────────────────────────── */}
          <div className="mx-7 mt-5 mb-5 grid grid-cols-2 md:grid-cols-4 hairline-t hairline-b">
            <KpiCard label="Всего задач" value={totalTasks} />
            <KpiCard label="Выполнено"   value={doneTasks}    border />
            <KpiCard label="В работе"    value={activeTasks}  border />
            <KpiCard label="Просрочено"  value={overdueTasks} border />
          </div>

          {/* ── Distribution donut + Priority breakdown ───────────────── */}
          <div className="px-7 mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-1 hairline flex flex-col">
              <SectionHead label="Распределение" />
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-6">
                <DonutChart
                  segments={[
                    { value: doneTasks,    color: 'var(--color-success)' },
                    { value: activeTasks,  color: 'var(--color-fg-primary)' },
                    { value: overdueTasks, color: 'var(--color-danger)' },
                  ]}
                  total={totalTasks}
                />
                {!noData && (
                  <div className="w-full max-w-xs flex flex-col gap-2">
                    {[
                      { label: 'Выполнено',  value: doneTasks,    color: 'bg-[var(--color-success)]' },
                      { label: 'В работе',   value: activeTasks,  color: 'bg-[var(--color-fg-primary)]' },
                      { label: 'Просрочено', value: overdueTasks, color: 'bg-[var(--color-danger)]' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.color}`} />
                          <span className="text-xs text-fg-secondary truncate">{row.label}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-mono text-fg-muted tabular-nums">{row.value}</span>
                          <span className="text-[11px] font-mono text-fg-subtle tabular-nums w-9 text-right">
                            {totalTasks > 0 ? Math.round((row.value / totalTasks) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface-1 hairline">
              <SectionHead label="По приоритетам" />
              {totalTasks === 0 ? (
                <EmptyHint>Нет задач</EmptyHint>
              ) : (
                PRIORITIES_META.map((p, i, arr) => (
                  <HBarRow
                    key={p.value}
                    label={p.label}
                    value={priorityCounts[p.value] ?? 0}
                    total={totalTasks}
                    color={p.color}
                    icon={<PriorityIcon priority={p.value} size={12} />}
                    isLast={i === arr.length - 1}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Boards progress (full width) ──────────────────────────── */}
          <div className="px-7 mb-5">
            <div className="bg-surface-1 hairline">
              <SectionHead
                label="Прогресс по доскам"
                meta={`${boardSummaries.length} ${pluralRu(boardSummaries.length, ['доска','доски','досок'])}`}
                action={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                    <span className="text-[10px] font-mono text-fg-muted">Выполнено</span>
                  </span>
                }
              />
              {boardSummaries.length === 0 ? (
                <EmptyHint>Нет данных по доскам</EmptyHint>
              ) : (
                boardSummaries.map((b, i) => (
                  <BoardRow
                    key={b.id} name={b.name}
                    done={b.done} active={b.active} overdue={b.overdue} total={b.total}
                    isLast={i === boardSummaries.length - 1}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Team workload + Overdue (side by side) ────────────────── */}
          <div className="px-7 mb-7 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-1 hairline">
              <SectionHead
                label="Нагрузка команды"
                meta={`${projectMembers.length} ${pluralRu(projectMembers.length, ['участник','участника','участников'])}`}
              />
              {byAssignee.length === 0 ? (
                <EmptyHint>{projectMembers.length === 0 ? 'Нет участников в проекте' : 'Задачи не назначены'}</EmptyHint>
              ) : (
                byAssignee.map((row, i) => (
                  <MemberWorkloadRow
                    key={row.member.id}
                    member={row.member}
                    active={row.active}
                    done={row.done}
                    overdue={row.overdue}
                    total={row.total}
                    maxTotal={maxMemberTotal}
                    isLast={i === byAssignee.length - 1}
                  />
                ))
              )}
            </div>

            <div className="bg-surface-1 hairline">
              <SectionHead
                label="Просроченные"
                meta={`${overdueTasks}`}
                action={
                  overdueTasks > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-danger">
                      <AlertTriangle size={11} strokeWidth={2.2} />
                      {overdueTasks} {pluralRu(overdueTasks, ['задача','задачи','задач'])}
                    </span>
                  )
                }
              />
              {overdueList.length === 0 ? (
                <EmptyHint>
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 size={20} className="text-fg-subtle" strokeWidth={1.5} />
                    <span>Нет просроченных задач</span>
                  </div>
                </EmptyHint>
              ) : (
                overdueList.map((task, i) => (
                  <TaskTableRow
                    key={task.id}
                    task={task}
                    members={projectMembers}
                    isLast={i === overdueList.length - 1}
                    onOpen={() => openTask(task)}
                    danger
                  />
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── Members tab: per-member task lists ─────────────────────── */
        <div className="px-7 mt-6 mb-10">
          {byAssignee.length === 0 ? (
            <div className="bg-surface-2 hairline-strong rounded-md p-14 flex flex-col items-center gap-4 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-3">
                <Users size={24} className="text-fg-subtle" strokeWidth={1.5} />
              </div>
              <p className="text-base text-fg-secondary">
                {projectMembers.length === 0 ? 'Нет участников в проекте' : 'У участников пока нет задач'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {byAssignee.map((row) => (
                <MemberTasksCard
                  key={row.member.id}
                  member={row.member}
                  tasks={row.tasks}
                  done={row.done}
                  active={row.active}
                  overdue={row.overdue}
                  onOpen={openTask}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
