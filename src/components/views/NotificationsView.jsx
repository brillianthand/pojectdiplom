import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, UserPlus, AtSign, MessageSquare, Check, X, Inbox, ChevronRight, Loader2, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'

/* ---------- MarkAllReadButton ---------- */

function MarkAllReadButton({ onClick, count }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const timerRef = useRef(null)

  const handleClick = async () => {
    if (busy || done) return
    setBusy(true)
    try {
      await onClick()
      setDone(true)
      timerRef.current = setTimeout(() => setDone(false), 2000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="group relative flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.13em] text-fg-primary disabled:opacity-60"
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin" />
      ) : done ? (
        <Check size={12} strokeWidth={2.5} />
      ) : (
        <CheckCheck size={12} strokeWidth={2} />
      )}
      <span className="relative">
        {done ? 'Готово' : 'Прочитать все'}
        <span className="absolute left-0 -bottom-px h-px w-full bg-fg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out" />
      </span>
    </button>
  )
}

/* ---------- helpers ---------- */

function relativeTime(dateStr) {
  if (!dateStr) return ''
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

function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

function dateGroupKey(dateStr) {
  const today = startOfDay(new Date())
  const day = startOfDay(new Date(dateStr))
  const diff = Math.round((today - day) / 86400000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 7) return 'week'
  if (diff < 30) return 'month'
  return 'older'
}

const GROUP_ORDER = ['today', 'yesterday', 'week', 'month', 'older']
const GROUP_LABELS = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: 'На этой неделе',
  month: 'В этом месяце',
  older: 'Ранее',
}

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'unread', label: 'Непрочитанные' },
]

function composeTitle(n, actor, project) {
  if (n.type === 'invite' && actor && project) {
    return { actor: actor.name || actor.email, verb: 'пригласил вас в проект', target: project.name }
  }
  if (n.type === 'assigned') {
    const m = /задачу:\s*(.+)$/i.exec(n.title || '')
    if (m) return { actor: null, verb: 'Назначена задача', target: m[1].trim() }
  }
  if (n.type === 'commented' && actor) {
    return { actor: actor.name || actor.email, verb: 'прокомментировал задачу: ', target: n.title }
  }
  if (n.type === 'mentioned' && actor) {
    return { actor: actor.name || actor.email, verb: 'упомянул вас в задаче: ', target: n.title }
  }
  if (n.type === 'role_changed') {
    // Title already includes project + role transition formatted by the backend.
    return { actor: null, verb: null, target: n.title }
  }
  return { actor: null, verb: null, target: n.title }
}

/* ---------- sub-components ---------- */

function InviteActions({ projectId, compact }) {
  const acceptInvite = useStore(s => s.acceptInvite)
  const declineInvite = useStore(s => s.declineInvite)
  const [busy, setBusy] = useState(null)

  const handle = async (e, kind) => {
    e.stopPropagation()
    if (busy) return
    setBusy(kind)
    try {
      if (kind === 'accept') await acceptInvite(projectId)
      else await declineInvite(projectId)
    } finally { setBusy(null) }
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? 'mt-2' : 'mt-2.5'}`}>
      <button
        onClick={e => handle(e, 'accept')}
        disabled={!!busy}
        className="flex items-center gap-1.5 px-3 h-7 bg-fg-primary text-bg text-xs font-mono uppercase tracking-[0.12em] hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        <Check size={11} strokeWidth={2.5} />
        Принять
      </button>
      <button
        onClick={e => handle(e, 'decline')}
        disabled={!!busy}
        className="flex items-center gap-1.5 px-3 h-7 hairline-strong text-fg-secondary text-xs font-mono uppercase tracking-[0.12em] hover:bg-surface-3 disabled:opacity-40 transition-colors"
      >
        <X size={11} strokeWidth={2.5} />
        Отклонить
      </button>
    </div>
  )
}

function FilterTab({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 h-10 text-sm transition-colors ${active ? 'text-fg-primary' : 'text-fg-muted hover:text-fg-secondary'
        }`}
    >
      <span className={active ? 'font-display-tight' : ''}>{label}</span>
      <span className={`text-xs font-mono tabular-nums px-1.5 py-0.5 ${active ? 'bg-fg-primary text-bg' : 'bg-surface-3 text-fg-secondary'
        }`}>
        {count}
      </span>
      {active && (
        <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-fg-primary" />
      )}
    </button>
  )
}

function InviteStatusBadge({ kind }) {
  const isAccepted = kind === 'accepted'
  return (
    <div className="flex items-center gap-1.5 mt-2 text-xs font-mono uppercase tracking-[0.12em] text-fg-subtle">
      {isAccepted
        ? <Check size={11} strokeWidth={2.5} />
        : <X size={11} strokeWidth={2.5} />}
      {isAccepted ? 'Принято' : 'Отклонено'}
    </div>
  )
}

function TypeIcon({ type }) {
  const icon =
    type === 'invite' ? <UserPlus size={12} strokeWidth={1.9} />
      : type === 'commented' ? <MessageSquare size={12} strokeWidth={1.9} />
        : type === 'mentioned' ? <AtSign size={12} strokeWidth={1.9} />
          : type === 'assigned' ? <AtSign size={12} strokeWidth={1.9} />
            : type === 'role_changed' ? <ShieldCheck size={12} strokeWidth={1.9} />
              : <Bell size={12} strokeWidth={1.9} />
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-fg-secondary">
      {icon}
    </div>
  )
}

function NotificationRow({ n, actor, project, inviteStatus, onOpen, onRead }) {
  const isInvite = n.type === 'invite' && n.projectId
  const pendingInvite = isInvite && inviteStatus === 'pending'
  const navigable = !!(n.taskId && n.boardId) || (n.type === 'role_changed' && n.projectId)
  const { actor: actorName, verb, target } = composeTitle(n, actor, project)

  // Клик по строке — только читает (не переносит). Pending invite — без клика.
  const handleRowClick = () => {
    if (!pendingInvite && !n.read) onRead?.(n.id)
  }

  const strong = n.read ? 'text-fg-primary' : 'text-fg-primary font-medium'

  return (
    <div
      onClick={handleRowClick}
      className={`group relative flex items-center gap-3 pl-10 pr-8 py-2.5 hairline-b transition-all ${!n.read ? 'cursor-pointer' : ''
        } ${n.read ? 'bg-transparent hover:bg-surface-2' : 'bg-surface-2 hover:bg-surface-2'
        }`}
    >
      {!n.read && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-fg-primary" />
      )}

      {/* Avatar / type icon */}
      {actor
        ? <Avatar initials={actor.initials} color={actor.color} avatarUrl={actor.avatarUrl} size="sm" className="flex-shrink-0" />
        : <TypeIcon type={n.type} />}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-snug">
          {actorName ? (
            <>
              <span className={strong}>{actorName}</span>
              <span className="text-fg-secondary"> {verb} </span>
              <span className={strong}>{target}</span>
            </>
          ) : verb ? (
            <>
              <span className="text-fg-secondary">{verb}: </span>
              <span className={strong}>{target}</span>
            </>
          ) : (
            <span className={strong}>{target}</span>
          )}
        </p>

        {pendingInvite && <InviteActions projectId={n.projectId} compact />}
        {isInvite && inviteStatus !== 'pending' && <InviteStatusBadge kind={inviteStatus} />}
      </div>

      {/* Right: time + actions */}
      <div className="relative flex-shrink-0 flex items-center justify-end gap-0.5 w-16">
        <span className={`text-xs font-mono tabular-nums text-fg-muted transition-opacity ${(navigable || !n.read) ? 'group-hover:opacity-0' : ''}`}>
          {relativeTime(n.createdAt)}
        </span>
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {!n.read && (
            <button
              onClick={e => { e.stopPropagation(); onRead?.(n.id) }}
              title="Отметить прочитанным"
              className="grid place-items-center w-6 h-6 rounded text-fg-subtle hover:bg-surface-3 hover:text-fg-primary"
            >
              <Check size={13} strokeWidth={2.5} />
            </button>
          )}
          {navigable && (
            <button
              onClick={() => onOpen?.(n)}
              title="Перейти"
              className="grid place-items-center w-6 h-6 rounded text-fg-subtle hover:bg-surface-3 hover:text-fg-primary"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- main view ---------- */

export function NotificationsView() {
  const {
    notifications, unreadCount, hasMoreNotifications,
    loadNotifications, loadMoreNotifications, markNotificationsRead, markNotificationRead, openNotification,
    users, projects, loadUsers,
  } = useStore()

  const [filter, setFilter] = useState('all')
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    loadNotifications()
    if (!users || users.length === 0) loadUsers?.()
  }, [])

  const usersById = useMemo(() => Object.fromEntries((users ?? []).map(u => [u.id, u])), [users])
  const projectsById = useMemo(() => Object.fromEntries((projects ?? []).map(p => [p.id, p])), [projects])
  const memberProjectIds = useMemo(() => new Set((projects ?? []).map(p => p.id)), [projects])

  /* Invite is pending when the project is NOT yet in user's projects list and
     the notification is still unread. Once accepted, the project appears in the
     user's projects list. Declined invites simply never enter — we infer that
     a read invite without a corresponding membership was declined or stale. */
  const inviteStatusFor = (n) => {
    if (n.type !== 'invite' || !n.projectId) return null
    if (memberProjectIds.has(n.projectId)) return 'accepted'
    if (n.read) return 'declined'
    return 'pending'
  }

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter(n => !n.read).length,
  }), [notifications])

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.read)
    return notifications
  }, [notifications, filter])

  const grouped = useMemo(() => {
    const map = {}
    for (const n of filtered) {
      const k = dateGroupKey(n.createdAt)
        ; (map[k] ??= []).push(n)
    }
    return GROUP_ORDER
      .filter(k => map[k]?.length)
      .map(k => ({ key: k, label: GROUP_LABELS[k], items: map[k] }))
  }, [filtered])

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Header */}
      <div className="px-10 pt-10 pb-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-2xl font-display-tight text-fg-primary">Уведомления</h1>
            <span className="text-xs font-mono tabular-nums text-fg-muted">
              {unreadCount > 0
                ? `${unreadCount} ${unreadCount === 1 ? 'непрочитанное' : 'непрочитанных'}`
                : 'всё прочитано'}
            </span>
          </div>
          {unreadCount > 0 && (
            <MarkAllReadButton onClick={markNotificationsRead} count={unreadCount} />
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-10 flex items-center gap-6 hairline-b">
        {FILTERS.map(f => (
          <FilterTab
            key={f.id}
            label={f.label}
            count={counts[f.id]}
            active={filter === f.id}
            onClick={() => setFilter(f.id)}
          />
        ))}
      </div>

      {/* Body */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 mt-24 text-fg-subtle">
          <div className="w-12 h-12 hairline-strong flex items-center justify-center">
            <Inbox size={18} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-mono uppercase tracking-[0.18em]">
            {filter === 'unread' ? 'Непрочитанных нет' : 'Уведомлений нет'}
          </p>
        </div>
      ) : (
        <div>
          {grouped.map(group => (
            <section key={group.key}>
              <div className="px-10 pt-6 pb-2 bg-surface-1/60">
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-fg-muted">
                  {group.label}
                </p>
              </div>
              {group.items.map(n => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  actor={n.actorId
                    ? usersById[n.actorId]
                    : n.invitedBy
                      ? usersById[n.invitedBy]
                      : null}
                  project={n.projectId ? projectsById[n.projectId] : null}
                  inviteStatus={inviteStatusFor(n)}
                  onOpen={openNotification}
                  onRead={markNotificationRead}
                />
              ))}
            </section>
          ))}

          {filter === 'all' && hasMoreNotifications && (
            <div className="flex justify-center py-8">
              <button
                onClick={async () => {
                  setLoadingMore(true)
                  await loadMoreNotifications()
                  setLoadingMore(false)
                }}
                disabled={loadingMore}
                className="flex items-center gap-2 h-9 px-5 hairline text-xs font-mono uppercase tracking-[0.14em] text-fg-muted hover:text-fg-primary hover:bg-surface-3 disabled:opacity-40 transition-colors"
              >
                {loadingMore
                  ? <Loader2 size={12} className="animate-spin" />
                  : null}
                {loadingMore ? 'Загрузка…' : 'Загрузить ещё'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
