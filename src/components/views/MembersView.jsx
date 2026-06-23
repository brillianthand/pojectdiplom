import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus, ChevronDown, Trash2, Mail, Crown, ArrowRightLeft, Loader2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { api } from '../../api/index'
import { Avatar } from '../ui/Avatar'
import { InviteMemberModal } from '../members/InviteMemberModal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import {
  ALL_ROLES,
  ROLE_ADMIN,
  ROLE_LABELS,
  usePermissions,
} from '../../lib/permissions'

function pluralPeople(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'человек'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'человека'
  return 'человек'
}

function RolePicker({ role, options, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (disabled) {
    return (
      <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">
        {ROLE_LABELS[role] ?? role}
      </span>
    )
  }

  const dropdown = open && createPortal(
    <div
      style={{ top: pos.top, right: pos.right, position: 'fixed', zIndex: 9999 }}
      className="min-w-[160px] bg-surface-1 hairline-strong shadow-lg"
    >
      {options.map(r => (
        <button
          key={r}
          onMouseDown={e => { e.preventDefault(); onChange(r); setOpen(false) }}
          className={`block w-full text-left px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] hover:bg-surface-3 transition-colors ${r === role ? 'text-fg-primary bg-surface-3/40' : 'text-fg-muted'
            }`}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>,
    document.body
  )

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="inline-flex items-center gap-1.5 h-7 px-2 hairline text-xs font-mono uppercase tracking-[0.14em] text-fg-primary hover:bg-surface-3 transition-colors"
      >
        {ROLE_LABELS[role] ?? role}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  )
}

function MemberRow({
  index, member, isYou, isProjectOwner, perms, ownerId,
  onChangeRole, onRemove, onTransfer, pending, online,
}) {
  const [busy, setBusy] = useState(false)

  const rolesForRow = ALL_ROLES.filter(r => r !== ROLE_ADMIN || perms.canAssignAdmin)
  const lockedRole = isProjectOwner || (member.role === ROLE_ADMIN && !perms.canAssignAdmin)

  const handleChangeRole = async (role) => {
    if (busy) return
    setBusy(true)
    try { await onChangeRole(role) } finally { setBusy(false) }
  }

  const handleRemove = async () => {
    if (busy) return
    setBusy(true)
    try { await onRemove() } finally { setBusy(false) }
  }

  return (
    <div className="group grid grid-cols-[44px_1fr_1.2fr_140px_104px] items-center px-4 py-3 hairline-b hover:bg-surface-3/40 transition-colors">
      <span className="text-xs font-mono tabular-nums text-fg-subtle">{index}</span>

      <div className="flex items-center gap-3 min-w-0">
        {pending ? (
          <div className="w-8 h-8 grid place-items-center hairline text-fg-subtle">
            <Mail size={13} />
          </div>
        ) : (
          <div className="relative flex-shrink-0">
            <Avatar initials={member.initials} color={member.color} avatarUrl={member.avatarUrl} size="md" />
            {online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-2" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-sm flex items-center gap-1.5 min-w-0 ${pending ? 'text-fg-muted italic' : 'text-fg-primary'}`}>
            <span className="truncate">{member.name}</span>
            {isProjectOwner && (
              <Crown size={11} strokeWidth={2} className="text-fg-primary flex-shrink-0" />
            )}
            {isYou && (
              <span className="flex-shrink-0 rounded-full bg-surface-3 px-1.5 py-px text-[9px] font-mono uppercase tracking-[0.12em] text-fg-muted">
                Вы
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="text-xs font-mono text-fg-muted truncate">{member.email}</p>

      <div className="flex items-center justify-start">
        {isProjectOwner ? (
          <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">Владелец</span>
        ) : (
          <RolePicker
            role={member.role}
            options={rolesForRow}
            onChange={handleChangeRole}
            disabled={!perms.canManageMembers || pending || isYou || lockedRole || busy}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        {pending ? (
          <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle">Ждёт</span>
        ) : isYou ? null : busy ? (
          <Loader2 size={14} className="animate-spin text-fg-subtle" />
        ) : (
          <>
            {perms.isOwner && !pending && member.id !== ownerId && (
              <button
                onClick={onTransfer}
                className="p-1 text-fg-subtle opacity-0 transition hover:text-fg-primary group-hover:opacity-100"
                title="Передать владение"
              >
                <ArrowRightLeft size={14} />
              </button>
            )}
            {perms.canManageMembers && !isProjectOwner && (
              <button
                onClick={handleRemove}
                className="p-1 text-fg-subtle opacity-0 transition hover:text-danger group-hover:opacity-100"
                title="Удалить участника"
              >
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function MembersView() {
  const activeProjectId = useStore(s => s.activeProjectId)
  const allMembers = useStore(s => s.members[s.activeProjectId]) ?? []
  const currentUser = useStore(s => s.currentUser)
  const project = useStore(s => s.projects.find(p => p.id === s.activeProjectId))
  const updateMemberRole = useStore(s => s.updateMemberRole)
  const removeMember = useStore(s => s.removeMember)
  const transferOwnership = useStore(s => s.transferOwnership)
  const perms = usePermissions()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState(null)
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => {
    let cancelled = false
    const fetch = () => api.getPresence().then(d => { if (!cancelled) setOnlineIds(new Set(d.ids)) }).catch(() => { })
    fetch()
    const timer = setInterval(fetch, 30_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const accepted = allMembers
    .filter(m => m.status !== 'pending')
    .sort((a, b) => {
      if (a.id === currentUser?.id) return -1
      if (b.id === currentUser?.id) return 1
      return 0
    })
  const pending = allMembers.filter(m => m.status === 'pending')
  const ownerId = project?.ownerId

  if (!activeProjectId) {
    return (
      <div className="flex-1 grid place-items-center text-sm font-mono text-fg-muted">
        Выберите проект
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-bg">
      <div className="max-w-[1100px] mx-auto px-8 py-10 flex flex-col gap-10">

        {/* Header */}
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted">Участники проекта</p>
          <div className="flex items-end justify-between mt-2 gap-4 flex-wrap">
            <h1 className="text-4xl font-display-tight text-fg-primary leading-[0.95]">
              Команда
            </h1>
            {perms.canManageMembers && (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 h-10 px-4 hairline-strong text-xs font-mono uppercase tracking-[0.14em] text-fg-primary hover:bg-surface-3 transition-colors"
              >
                <UserPlus size={14} />
                Пригласить
              </button>
            )}
          </div>
        </header>

        {/* Active members table */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">
              Активные <span className="text-fg-primary">({accepted.length})</span>{' '}
              <span className="text-fg-subtle">— {accepted.length} {pluralPeople(accepted.length)}</span>
            </p>
          </div>

          <div className="bg-surface-2 hairline">
            <div className="grid grid-cols-[44px_1fr_1.2fr_140px_104px] px-4 py-2 hairline-b">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">№</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">Имя</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">Email</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">Роль</span>
              <span />
            </div>
            {accepted.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-mono text-fg-subtle">
                В проекте пока нет активных участников
              </div>
            ) : accepted.map((m, i) => (
              <MemberRow
                key={m.id}
                index={i + 1}
                member={m}
                isYou={m.id === currentUser?.id}
                isProjectOwner={m.id === ownerId}
                perms={perms}
                ownerId={ownerId}
                online={m.id === currentUser?.id || onlineIds.has(m.id)}
                onChangeRole={role => updateMemberRole(m.id, role)}
                onRemove={() => removeMember(m.id)}
                onTransfer={() => setTransferTarget(m)}
              />
            ))}
          </div>
        </section>

        {/* Pending invites */}
        {pending.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">
                Ожидают принятия <span className="text-fg-primary">({pending.length})</span>
              </p>
            </div>

            <div className="bg-surface-2 hairline">
              <div className="grid grid-cols-[44px_1fr_1.2fr_140px_104px] px-4 py-2 hairline-b">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">№</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">Имя</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">Email</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary">Роль</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-primary text-right">Статус</span>
              </div>
              {pending.map((m, i) => (
                <MemberRow
                  key={m.id}
                  index={i + 1}
                  member={m}
                  isYou={false}
                  isProjectOwner={false}
                  perms={perms}
                  ownerId={ownerId}
                  pending
                  onChangeRole={() => { }}
                  onRemove={() => removeMember(m.id)}
                  onTransfer={() => { }}
                />
              ))}
            </div>
          </section>
        )}

      </div>

      {inviteOpen && <InviteMemberModal onClose={() => setInviteOpen(false)} />}

      {transferTarget && (
        <ConfirmDialog
          title="Передать владение проектом?"
          message={`Вы передаёте права владельца пользователю ${transferTarget.name}. После этого только он сможет удалить проект и передать владение дальше. Ваша роль останется «${ROLE_LABELS[ROLE_ADMIN]}».`}
          confirmLabel="Передать"
          danger={false}
          onConfirm={async () => {
            await transferOwnership(transferTarget.id)
            setTransferTarget(null)
          }}
          onCancel={() => setTransferTarget(null)}
        />
      )}
    </div>
  )
}
