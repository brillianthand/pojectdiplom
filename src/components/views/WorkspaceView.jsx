import { useEffect, useState } from 'react'
import {
  Mail, Plus, ArrowRight, ChevronDown,
  Sparkles, Pencil, AlignLeft, Calendar, Check, Clock,
  ArrowRightLeft, UserPlus, UserMinus, Tag as TagIcon, Archive, Activity,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'
import { CreateProjectModal } from '../project/CreateProjectModal'
import { ProjectModal } from '../project/ProjectModal'
import { getRecents } from '../../utils/recents'

const PROJECT_LIMIT = 3

function pad2(n) { return String(n).padStart(2, '0') }

function relativeShort(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'сейчас'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} д`
  return `${Math.floor(d / 30)} мес`
}

function pluralRu(n, [one, few, many]) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function SectionCaption({ label, meta }) {
  return (
    <div className="flex items-baseline justify-between mb-6">
      <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">{label}</p>
      {meta && (
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle tabular-nums">{meta}</p>
      )}
    </div>
  )
}

function ProjectCard({ project, onOpen }) {
  const total = project.tasksTotal
  const done = project.tasksDone
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col text-left bg-surface-2 hairline hover:hairline-strong transition-colors"
    >
      <div className="flex flex-col px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display-tight text-xl text-fg-primary truncate">{project.name}</h3>
          {project.status === 'completed' ? (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.1em] bg-[#E5484D]/10 text-[#E5484D] border border-[#E5484D]/20">Завершён</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.1em] bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20">Активен</span>
          )}
        </div>
        {project.lastActivity && (
          <span className="text-xs font-mono text-fg-subtle mt-1.5">
            {relativeShort(project.lastActivity)}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">Прогресс</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono text-fg-subtle tabular-nums">{done} / {total}</span>
              <span className="text-xs font-mono text-fg-secondary tabular-nums">{pct}%</span>
            </div>
          </div>
          <div className="h-[3px] bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-fg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="hairline-t" />

      <div className="grid grid-cols-3 px-5 py-3">
        <Stat label="Задач" value={total} />
        <Stat label="Досок" value={project.boardsCount} />
        <Stat label="Участники" value={project.membersCount} />
      </div>

      <span className="absolute right-4 bottom-3 text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight size={14} strokeWidth={1.5} />
      </span>
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle">{label}</span>
      <span className="text-base font-display-tight text-fg-primary tabular-nums">{value}</span>
    </div>
  )
}

function PendingRow({ invite, index }) {
  return (
    <div className="grid grid-cols-[44px_1fr_1.2fr_64px] items-center gap-4 px-5 py-3 hairline-b last:border-b-0">
      <span className="text-xs font-mono text-fg-subtle tabular-nums">{pad2(index)}</span>
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-7 h-7 grid place-items-center bg-surface-3 hairline rounded-full flex-shrink-0">
          <Mail size={12} strokeWidth={1.5} className="text-fg-secondary" />
        </span>
        <span className="text-sm text-fg-muted italic truncate">приглашение</span>
      </div>
      <span className="text-xs font-mono text-fg-muted truncate">{invite.email}</span>
      <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle text-right">Ждёт</span>
    </div>
  )
}

function EmptyProjects({ onCreate }) {
  return (
    <div className="hairline bg-surface-2 px-8 py-16 flex flex-col items-center text-center">
      <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle mb-3">Пусто</p>
      <h3 className="text-2xl font-display-tight text-fg-primary mb-2">Здесь пока ничего нет</h3>
      <p className="text-sm text-fg-muted max-w-sm mb-6">
        Создайте первый проект, чтобы начать работу. Можно сразу пригласить команду по email.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors"
      >
        <Plus size={14} strokeWidth={2} />
        Новый проект
      </button>
    </div>
  )
}

function Total({ label, value, border }) {
  return (
    <div className={`flex flex-col gap-2 px-6 py-5 ${border ? 'hairline-l' : ''}`}>
      <span className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">{label}</span>
      <span className="text-3xl font-display-tight text-fg-primary tabular-nums leading-none">
        {value}
      </span>
    </div>
  )
}

const SORT_OPTIONS = [
  { key: 'activity', label: 'Активность' },
  { key: 'name', label: 'Имя' },
  { key: 'progress', label: 'Прогресс' },
]

function RecentRow({ item, index, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group grid items-center gap-4 px-5 py-3 hairline-b last:border-b-0 text-left hover:bg-surface-3/40 transition-colors w-full"
      style={{ gridTemplateColumns: '24px 1fr auto auto' }}
    >
      <span className="text-xs font-mono text-fg-primary tabular-nums">{index}</span>
      <div className="min-w-0">
        <span className="block text-sm text-fg-primary truncate">{item.title}</span>
        <span className="block text-[11px] font-mono text-fg-subtle truncate mt-0.5">{item.subtitle}</span>
      </div>
      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-fg-primary">
        {item.type === 'board' ? 'Доска' : 'Задача'}
      </span>
      <ArrowRight size={13} strokeWidth={1.5} className="text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

function sortProjects(projects, sort) {
  const arr = [...projects]
  if (sort === 'name') return arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  if (sort === 'progress') return arr.sort((a, b) => {
    const pa = a.tasksTotal > 0 ? a.tasksDone / a.tasksTotal : 0
    const pb = b.tasksTotal > 0 ? b.tasksDone / b.tasksTotal : 0
    return pb - pa
  })
  // activity — по lastActivity (новее первым), без даты — в конец
  return arr.sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0
    if (!a.lastActivity) return 1
    if (!b.lastActivity) return -1
    return new Date(b.lastActivity) - new Date(a.lastActivity)
  })
}

// describeFeed maps a task_events row to (icon, sentence). Sentence is split
// into a verb part and a target part so the target can be rendered as a
// distinct link-styled chip inside the row.
function describeFeed(ev) {
  const p = ev.payload || {}
  switch (ev.type) {
    case 'created': return { icon: Sparkles, verb: 'создал задачу', target: ev.taskTitle }
    case 'title_changed': return { icon: Pencil, verb: 'переименовал задачу в', target: p.to || ev.taskTitle }
    case 'description_changed': return { icon: AlignLeft, verb: 'изменил описание задачи', target: ev.taskTitle }
    case 'priority_changed': return { icon: Activity, verb: 'изменил приоритет', target: ev.taskTitle }
    case 'type_changed': return { icon: Activity, verb: 'изменил тип', target: ev.taskTitle }
    case 'start_date_changed': return { icon: Calendar, verb: 'изменил дату начала', target: ev.taskTitle }
    case 'due_date_changed': return { icon: Calendar, verb: 'изменил дедлайн', target: ev.taskTitle }
    case 'completed_changed': return p.completed
      ? { icon: Check, verb: 'закрыл задачу', target: ev.taskTitle }
      : { icon: Clock, verb: 'вернул в работу задачу', target: ev.taskTitle }
    case 'moved': return { icon: ArrowRightLeft, verb: `переместил в «${p.toColumnTitle || '—'}»`, target: ev.taskTitle }
    case 'assignee_added': return { icon: UserPlus, verb: 'добавил исполнителя в задачу', target: ev.taskTitle }
    case 'assignee_removed': return { icon: UserMinus, verb: 'снял исполнителя с задачи', target: ev.taskTitle }
    case 'tag_added': return { icon: TagIcon, verb: `добавил тег «${p.tag || ''}» к задаче`, target: ev.taskTitle }
    case 'tag_removed': return { icon: TagIcon, verb: `убрал тег «${p.tag || ''}» с задачи`, target: ev.taskTitle }
    case 'archived': return { icon: Archive, verb: 'архивировал задачу', target: ev.taskTitle }
    case 'restored': return { icon: Archive, verb: 'восстановил задачу', target: ev.taskTitle }
    default: return { icon: Activity, verb: ev.type, target: ev.taskTitle }
  }
}

function FeedRow({ ev, onOpen }) {
  const users = useStore(s => s.users)
  const { icon: Icon, verb, target } = describeFeed(ev)
  const actor = ev.userName || 'Пользователь'
  const avatarUrl = users.find(u => u.id === ev.userId)?.avatarUrl || ''
  return (
    <button
      onClick={onOpen}
      className="group grid items-center gap-4 px-5 py-3 hairline-b last:border-b-0 text-left hover:bg-surface-3/40 transition-colors w-full"
      style={{ gridTemplateColumns: '22px auto 1fr auto' }}
    >
      <span className="w-[22px] h-[22px] grid place-items-center rounded-full bg-surface-3 text-fg-muted">
        <Icon size={11} strokeWidth={1.75} />
      </span>
      <Avatar
        initials={ev.userInitials || (actor[0] || '?').toUpperCase()}
        color={ev.userColor}
        avatarUrl={avatarUrl}
        size="sm"
      />
      <div className="min-w-0">
        <p className="text-sm text-fg-secondary leading-snug truncate">
          <span className="font-medium text-fg-primary">{actor}</span>{' '}
          <span className="text-fg-muted">{verb}</span>{' '}
          <span className="font-medium text-fg-primary">«{target}»</span>
        </p>
        <p className="text-[11px] font-mono truncate mt-0.5">
          <span className="text-fg-muted">Проект </span>
          <span className="text-fg-primary">{ev.projectName}</span>
          {ev.boardName && <>
            <span className="text-fg-muted">  Доска </span>
            <span className="text-fg-primary">{ev.boardName}</span>
          </>}
        </p>
      </div>
      <span className="text-xs font-mono text-fg-primary tabular-nums whitespace-nowrap">
        {ev.time}
      </span>
    </button>
  )
}

export function WorkspaceView() {
  const { workspace, loadWorkspace, currentUser, setActiveProject, setActiveBoard, setActiveTask, feed, feedLoading, loadFeed, navigateToTask, loadUsers } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [activeProject, setActiveProjectModal] = useState(null)
  const [sort, setSort] = useState('activity')
  const [recents] = useState(() => getRecents())

  useEffect(() => { loadWorkspace(); loadFeed(); loadUsers() }, [])

  const handleRecentClick = async (item) => {
    if (item.type === 'board') {
      setActiveProject(item.projectId)
      await setActiveBoard(item.id)
    } else {
      setActiveProject(item.projectId)
      await setActiveBoard(item.boardId)
      setActiveTask(item.id)
    }
  }

  if (!workspace) {
    return (
      <div className="h-full flex items-center justify-center text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle">
        Загрузка…
      </div>
    )
  }

  const { projects, pendingInvites, totals } = workspace
  const firstName = currentUser?.name?.split(' ')[0] || currentUser?.email?.split('@')[0] || ''
  const sortedProjects = sortProjects(projects, sort)
  const visibleProjects = showAll ? sortedProjects : sortedProjects.slice(0, PROJECT_LIMIT)
  const hiddenCount = projects.length - PROJECT_LIMIT

  return (
    <>
      <div className="h-full overflow-y-auto bg-bg">
        <div className="max-w-[1200px] mx-auto px-10 py-12">

          {/* ── Greeting header ──────────────────────── */}
          <header className="hairline-b pb-10 mb-12">
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <h1 className="text-5xl font-display-tight text-fg-primary leading-[0.95]">
                Привет{firstName ? `, ${firstName}` : ''}.
              </h1>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 hairline-strong hover:bg-surface-3 text-sm text-fg-primary transition-colors"
              >
                <Plus size={13} strokeWidth={1.75} />
                Новый проект
              </button>
            </div>

            <div className="grid grid-cols-2 mt-10 hairline-t">
              <Total label="Проекты" value={totals.projectsCount} />
              <Total label="Мои задачи" value={totals.tasksOpen} border />
            </div>
          </header>

          {/* ── Projects ─────────────────────────────── */}
          <section className="mb-14">
            <div className="flex items-baseline justify-between mb-6">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">Проекты</p>
              <div className="flex items-center gap-1">
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    onClick={() => setSort(o.key)}
                    className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors rounded-sm ${sort === o.key
                        ? 'bg-surface-3 text-fg-primary'
                        : 'text-fg-subtle hover:text-fg-muted'
                      }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {projects.length === 0 ? (
              <EmptyProjects onCreate={() => setShowCreate(true)} />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleProjects.map((p, i) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onOpen={() => setActiveProjectModal({ project: p })}
                    />
                  ))}
                </div>

                {!showAll && hiddenCount > 0 && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 hover:bg-surface-2 text-xs font-mono uppercase tracking-[0.16em] text-fg-muted transition-colors"
                  >
                    <ChevronDown size={13} strokeWidth={1.75} />
                    Показать ещё {hiddenCount} {pluralRu(hiddenCount, ['проект', 'проекта', 'проектов'])}
                  </button>
                )}
                {showAll && hiddenCount > 0 && (
                  <button
                    onClick={() => setShowAll(false)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 hover:bg-surface-2 text-xs font-mono uppercase tracking-[0.16em] text-fg-muted transition-colors"
                  >
                    <ChevronDown size={13} strokeWidth={1.75} className="rotate-180" />
                    Свернуть
                  </button>
                )}
              </>
            )}
          </section>

          {/* ── Recents + Activity (two columns) ───────── */}
          <div className="grid grid-cols-2 gap-8 mb-14">
            <section>
              <SectionCaption label="Активность" />
              <div className="bg-surface-2 shadow-sm rounded-xl overflow-hidden">
                {feedLoading && feed.length === 0 ? (
                  <div className="px-5 py-6 text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle">
                    Загрузка…
                  </div>
                ) : feed.length === 0 ? (
                  <div className="px-5 py-6 text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle">
                    Нет активности
                  </div>
                ) : (
                  feed.slice(0, 10).map(ev => (
                    <FeedRow
                      key={ev.id}
                      ev={ev}
                      onOpen={() => navigateToTask(ev.taskId, ev.boardId, ev.projectId)}
                    />
                  ))
                )}
              </div>
            </section>

            <section>
              <SectionCaption label="Недавно" />
              <div className="bg-surface-2 shadow-sm rounded-xl overflow-hidden">
                {recents.length > 0 ? recents.map((item, i) => (
                  <RecentRow
                    key={`${item.type}-${item.id}`}
                    item={item}
                    index={i + 1}
                    onClick={() => handleRecentClick(item)}
                  />
                )) : (
                  <div className="px-5 py-6 text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle">
                    Ничего не открывали
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Pending invites ───────────────────────── */}
          {pendingInvites.length > 0 && (
            <section className="mb-14">
              <SectionCaption
                label="Ожидают приглашение"
                meta={String(pendingInvites.length)}
              />
              <div className="bg-surface-2 hairline">
                {pendingInvites.map((inv, i) => (
                  <PendingRow key={inv.email} invite={inv} index={i + 1} />
                ))}
              </div>
            </section>
          )}

          <footer className="hairline-t pt-6 pb-2">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle">
              {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {activeProject && (
        <ProjectModal
          project={activeProject.project}
          onClose={() => setActiveProjectModal(null)}
        />
      )}
    </>
  )
}
