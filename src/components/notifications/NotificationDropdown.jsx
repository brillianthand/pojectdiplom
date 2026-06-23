import { useEffect, useRef, useMemo, useState } from 'react'
import {
  Bell, CheckCheck, UserPlus, AtSign, MessageSquare,
  Check, X, Inbox, ChevronRight, ArrowUpRight, ShieldCheck,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'

/* ---------- helpers ---------- */

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'сейчас'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} д`
  return `${Math.floor(d / 30)} мес`
}

/* ---------- NotifIcon ---------- */
function NotifIcon({ type }) {
  const cls = 'w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0'
  if (type === 'invite')    return <div className={`${cls} bg-purple-500/15 text-purple-400`}><UserPlus size={13} strokeWidth={1.9} /></div>
  if (type === 'assigned')  return <div className={`${cls} bg-accent/15 text-accent`}><AtSign size={13} strokeWidth={1.9} /></div>
  if (type === 'commented') return <div className={`${cls} bg-emerald-500/15 text-emerald-400`}><MessageSquare size={13} strokeWidth={1.9} /></div>
  if (type === 'mentioned')    return <div className={`${cls} bg-amber-500/15 text-amber-400`}><AtSign size={13} strokeWidth={1.9} /></div>
  if (type === 'role_changed') return <div className={`${cls} bg-sky-500/15 text-sky-500`}><ShieldCheck size={13} strokeWidth={1.9} /></div>
  return <div className={`${cls} bg-surface-3 text-fg-secondary`}><Bell size={13} strokeWidth={1.9} /></div>
}

/* ---------- InviteButtons ---------- */
function InviteButtons({ projectId }) {
  const acceptInvite  = useStore(s => s.acceptInvite)
  const declineInvite = useStore(s => s.declineInvite)
  const [busy, setBusy] = useState(null)

  const handle = async (e, kind) => {
    e.stopPropagation()
    if (busy) return
    setBusy(kind)
    try {
      if (kind === 'accept') await acceptInvite(projectId)
      else                   await declineInvite(projectId)
    } finally { setBusy(null) }
  }

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <button
        onClick={e => handle(e, 'accept')}
        disabled={!!busy}
        className="flex items-center gap-1 px-2.5 h-6 bg-fg-primary text-bg text-[11px] font-medium rounded hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        <Check size={10} strokeWidth={2.5} />
        Принять
      </button>
      <button
        onClick={e => handle(e, 'decline')}
        disabled={!!busy}
        className="flex items-center gap-1 px-2.5 h-6 border border-line text-fg-secondary text-[11px] font-medium rounded hover:bg-surface-3 disabled:opacity-40 transition-colors"
      >
        <X size={10} strokeWidth={2.5} />
        Отклонить
      </button>
    </div>
  )
}

/* ---------- NotifRow ---------- */
function NotifRow({ n, actor, project, inviteStatus, onOpen, onRead }) {
  const isInvite  = n.type === 'invite' && n.projectId
  const navigable = !!(n.taskId && n.boardId) || (n.type === 'role_changed' && n.projectId)

  const label = useMemo(() => {
    if (n.type === 'invite' && actor && project) {
      return { strong: actor.name || actor.email, rest: ` пригласил вас в проект `, target: project.name }
    }
    if (n.type === 'assigned') {
      return { strong: null, rest: 'Вас назначили на задачу: ', target: n.title }
    }
    if (n.type === 'commented' && actor) {
      return { strong: actor.name || actor.email, rest: ' прокомментировал задачу: ', target: n.title }
    }
    if (n.type === 'mentioned' && actor) {
      return { strong: actor.name || actor.email, rest: ' упомянул вас в задаче: ', target: n.title }
    }
    if (n.type === 'role_changed') {
      return { strong: null, rest: null, target: n.title }
    }
    return { strong: null, rest: null, target: n.title }
  }, [n, actor, project])

  return (
    <div
      onClick={() => !n.read && onRead?.(n.id)}
      className={`group relative flex items-start gap-2.5 px-4 py-3 transition-colors border-b border-line last:border-0 ${
        !n.read ? 'cursor-pointer bg-accent/[0.04] hover:bg-accent/[0.07]' : 'hover:bg-surface-3/50'
      }`}
    >
      {!n.read && (
        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent" />
      )}

      {/* Icon / Avatar */}
      <div className="mt-0.5 flex-shrink-0">
        {actor
          ? <Avatar initials={actor.initials} color={actor.color} avatarUrl={actor.avatarUrl} size="sm" />
          : <NotifIcon type={n.type} />}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] leading-snug">
          {label.strong && (
            <span className={`font-medium ${n.read ? 'text-fg-secondary' : 'text-fg-primary'}`}>
              {label.strong}
            </span>
          )}
          {label.rest && (
            <span className="text-fg-muted">{label.rest}</span>
          )}
          <span className="font-medium text-fg-primary">
            {label.target}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-fg-subtle tabular-nums">{relativeTime(n.createdAt)}</p>

        {isInvite && inviteStatus === 'pending' && <InviteButtons projectId={n.projectId} />}
        {isInvite && inviteStatus === 'accepted' && (
          <p className="mt-1 text-[11px] text-fg-subtle">Вы вступили в проект</p>
        )}
        {isInvite && inviteStatus === 'declined' && (
          <p className="mt-1 text-[11px] text-fg-subtle">Приглашение отклонено</p>
        )}
      </div>

      {navigable && (
        <button
          onClick={e => { e.stopPropagation(); onOpen?.(n) }}
          title="Перейти"
          className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-fg-subtle hover:text-fg-primary"
        >
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  )
}

/* ---------- NotificationDropdown ---------- */
export function NotificationDropdown({ onOpenFull }) {
  const {
    notifications, unreadCount,
    loadNotifications, markNotificationsRead, markNotificationRead, openNotification,
    users, projects, loadUsers,
  } = useStore()

  const [open, setOpen]     = useState(false)
  const [filter, setFilter] = useState('all')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reload when opened
  useEffect(() => {
    if (!open) return
    loadNotifications()
    if (!users || users.length === 0) loadUsers?.()
  }, [open])

  const usersById    = useMemo(() => Object.fromEntries((users    ?? []).map(u => [u.id, u])), [users])
  const projectsById = useMemo(() => Object.fromEntries((projects ?? []).map(p => [p.id, p])), [projects])
  const memberProjectIds = useMemo(() => new Set((projects ?? []).map(p => p.id)), [projects])

  const inviteStatusFor = (n) => {
    if (n.type !== 'invite' || !n.projectId) return null
    if (memberProjectIds.has(n.projectId)) return 'accepted'
    if (n.read) return 'declined'
    return 'pending'
  }

  const filtered = useMemo(() => {
    const list = filter === 'unread' ? notifications.filter(n => !n.read) : notifications
    return list.slice(0, 12)
  }, [notifications, filter])

  const unreadInView = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const handleOpen = (n) => {
    setOpen(false)
    openNotification(n)
  }

  const handleMarkAll = (e) => {
    e.stopPropagation()
    markNotificationsRead()
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative w-7 h-7 grid place-items-center rounded-md transition-colors ${
          open
            ? 'bg-surface-3 text-fg-primary'
            : 'text-fg-muted hover:text-fg-primary hover:bg-surface-3'
        }`}
        title="Уведомления"
      >
        <Bell size={15} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 grid place-items-center bg-accent text-white rounded-full text-[9px] font-display-tight tabular-nums pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-[380px] bg-surface-2 border border-line-strong rounded-xl shadow-2xl shadow-black/40 z-[60] overflow-hidden animate-fade-in flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-display-tight text-fg-primary">Уведомления</span>
            {unreadInView > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg-primary transition-colors"
              >
                <CheckCheck size={12} />
                Прочитать все
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-0 px-4 border-b border-line">
            {[
              { id: 'all',    label: 'Все',            count: notifications.length },
              { id: 'unread', label: 'Непрочитанные',  count: unreadInView },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`relative flex items-center gap-1.5 h-9 mr-4 text-xs transition-colors ${
                  filter === tab.id
                    ? 'text-fg-primary font-medium'
                    : 'text-fg-muted hover:text-fg-secondary'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] tabular-nums px-1 py-0.5 rounded ${
                  filter === tab.id ? 'bg-fg-primary text-bg' : 'bg-surface-3 text-fg-secondary'
                }`}>{tab.count}</span>
                {filter === tab.id && (
                  <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-fg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto max-h-[400px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-fg-subtle">
                <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center">
                  <Inbox size={16} strokeWidth={1.5} />
                </div>
                <p className="text-xs">
                  {filter === 'unread' ? 'Непрочитанных нет' : 'Уведомлений нет'}
                </p>
              </div>
            ) : (
              filtered.map(n => (
                <NotifRow
                  key={n.id}
                  n={n}
                  actor={n.actorId
                    ? usersById[n.actorId]
                    : n.invitedBy
                      ? usersById[n.invitedBy]
                      : null}
                  project={n.projectId ? projectsById[n.projectId] : null}
                  inviteStatus={inviteStatusFor(n)}
                  onOpen={handleOpen}
                  onRead={markNotificationRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <button
            onClick={() => { setOpen(false); onOpenFull?.() }}
            className="flex items-center justify-center gap-1.5 py-2.5 border-t border-line text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3/50 transition-colors"
          >
            Все уведомления
            <ArrowUpRight size={12} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  )
}
