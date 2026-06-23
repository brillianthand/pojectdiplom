import { useEffect, useRef, useState } from 'react'
import { X, ArrowRight, Check, Mail, ChevronDown, UserPlus, Crown, Loader2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { InviteMemberModal } from '../members/InviteMemberModal'
import { ROLE_LABELS, can, usePermissions } from '../../lib/permissions'

const ASSIGNABLE_ROLES = ['manager', 'executor', 'observer']

function InlineRolePicker({ role, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  if (disabled) {
    return <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle">{ROLE_LABELS[role] ?? role}</span>
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-[0.14em] text-fg-muted hover:text-fg-primary transition-colors"
      >
        {ROLE_LABELS[role] ?? role}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-[160px] bg-surface-1 hairline-strong shadow-md">
          {ASSIGNABLE_ROLES.map(r => (
            <button
              key={r}
              onMouseDown={e => { e.preventDefault(); onChange(r); setOpen(false) }}
              className={`block w-full text-left px-3 py-2 text-xs font-mono uppercase tracking-[0.14em] hover:bg-surface-3 transition-colors ${r === role ? 'text-fg-primary' : 'text-fg-muted'}`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


function pad2(n) { return String(n).padStart(2, '0') }

function relativeShort(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} д назад`
  return `${Math.floor(d / 30)} мес назад`
}

function StatCell({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">{label}</span>
      <span className="text-2xl font-display-tight text-fg-primary tabular-nums leading-none">{value}</span>
    </div>
  )
}

export function ProjectModal({ project: projectProp, onClose }) {
  const { members, loadMembers, updateProject, deleteProject, setActiveProject, setActiveBoard, projects, workspace, currentUser, updateMemberRole } = useStore()
  const perms = usePermissions(projectProp.id)

  // Live data from store so renames/updates are reflected immediately
  const project = workspace?.projects.find(p => p.id === projectProp.id) ?? projectProp

  const projectMembers = members[projectProp.id] ?? []
  const projectBoards  = projects.find(p => p.id === projectProp.id)?.boards ?? []

  const accepted = projectMembers.filter(m => m.status !== 'pending')
  const pending  = projectMembers.filter(m => m.status === 'pending')

  const [isRenaming, setIsRenaming]               = useState(false)
  const [nameInput, setNameInput]                 = useState(project.name)
  const [renameBusy, setRenameBusy]               = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [showInvite, setShowInvite]               = useState(false)

  const nameRef = useRef(null)

  useEffect(() => {
    loadMembers(project.id)
  }, [project.id])

  useEffect(() => {
    if (isRenaming) nameRef.current?.focus()
  }, [isRenaming])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !showConfirmDelete && !showInvite) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, showConfirmDelete, showInvite])

  const total = project.tasksTotal
  const done  = project.tasksDone
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const handleRename = async () => {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== project.name) {
      setRenameBusy(true)
      try {
        await updateProject(project.id, { name: trimmed })
      } finally {
        setRenameBusy(false)
      }
    } else {
      setNameInput(project.name)
    }
    setIsRenaming(false)
  }

  const handleDelete = async () => {
    onClose()
    await deleteProject(project.id)
  }

  const handleGoToBoard = () => {
    setActiveProject(project.id)
    onClose()
  }

  const handleGoToSpecificBoard = async (boardId) => {
    setActiveProject(project.id)
    await setActiveBoard(boardId)
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full max-w-[560px] max-h-[90vh] flex flex-col bg-surface-2 hairline-strong rounded-lg shadow-[0_24px_60px_-12px_rgba(0,0,0,0.18)] overflow-hidden">

          {/* ── Header ───────────────────────────────── */}
          <div className="flex items-center justify-between px-8 py-5 hairline-b flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-display-tight uppercase tracking-[0.18em] text-fg-primary">Проект</span>
              <button
                onClick={() => perms.canManageProject && updateProject(project.id, { status: project.status === 'completed' ? 'active' : 'completed' })}
                disabled={!perms.canManageProject}
                className={`text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border transition-colors ${
                  project.status === 'completed'
                    ? 'bg-[#E5484D]/10 text-[#E5484D] border-[#E5484D]/20 hover:bg-[#E5484D]/20'
                    : 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20 hover:bg-[#16A34A]/20'
                } ${!perms.canManageProject ? 'cursor-default pointer-events-none' : ''}`}
                title={perms.canManageProject ? 'Нажмите, чтобы изменить статус' : undefined}
              >
                {project.status === 'completed' ? 'Завершён' : 'Активен'}
              </button>
            </div>
            <button onClick={onClose} className="text-fg-muted hover:text-fg-primary transition-colors">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* ── Scrollable body ───────────────────────── */}
          <div className="overflow-y-auto flex-1">

            {/* Title */}
            <div className="px-8 py-7 hairline-b">
              {isRenaming ? (
                <div className="flex items-baseline gap-3">
                  <input
                    ref={nameRef}
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  handleRename()
                      if (e.key === 'Escape') { setNameInput(project.name); setIsRenaming(false) }
                    }}
                    className="flex-1 bg-transparent border-b border-fg-primary text-3xl font-display-tight text-fg-primary outline-none py-1"
                  />
                  <button
                    onClick={handleRename}
                    disabled={renameBusy}
                    className="text-fg-muted hover:text-fg-primary disabled:opacity-40 transition-colors pb-1"
                  >
                    {renameBusy
                      ? <Loader2 size={18} className="animate-spin" />
                      : <Check size={18} strokeWidth={1.5} />}
                  </button>
                </div>
              ) : (
                <div className="flex items-baseline gap-4">
                  <h2 className="text-3xl font-display-tight text-fg-primary leading-none flex-1 min-w-0 truncate">
                    {project.name}
                  </h2>
                  {perms.canManageProject && (
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle hover:text-fg-primary transition-colors flex-shrink-0"
                    >
                      Переименовать
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs font-mono text-fg-subtle mt-3">
                {project.lastActivity
                  ? `Последняя активность — ${relativeShort(project.lastActivity)}`
                  : 'Активности ещё не было'}
              </p>
            </div>

            {/* Stats */}
            <div className="px-8 py-6 hairline-b">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary mb-5">Статистика</p>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCell label="Задач"      value={total} />
                <StatCell label="Выполнено"  value={done} />
                <StatCell label="Досок"      value={project.boardsCount} />
                <StatCell label="Участников" value={project.membersCount} />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">Прогресс</span>
                  {total > 0 ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono text-fg-subtle tabular-nums">{done} / {total}</span>
                      <span className="text-xs font-mono text-fg-secondary tabular-nums">{pct}%</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-fg-subtle">нет задач</span>
                  )}
                </div>
                <div className="h-[3px] bg-surface-3">
                  <div className="h-full bg-fg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>

            {/* Boards */}
            {projectBoards.length > 0 && (
              <div className="px-8 py-6 hairline-b">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary mb-4">
                  Доски {projectBoards.length}
                </p>
                <div className="flex flex-col">
                  {projectBoards.map((b, i) => (
                    <button
                      key={b.id}
                      onClick={() => handleGoToSpecificBoard(b.id)}
                      className={`group flex items-center gap-3 py-2.5 text-left hover:bg-surface-3/40 -mx-2 px-2 transition-colors rounded-sm ${i < projectBoards.length - 1 ? 'hairline-b' : ''}`}
                    >
                      <span className="text-xs font-mono text-fg-subtle tabular-nums w-5 flex-shrink-0">
                        {pad2(i + 1)}
                      </span>
                      <span className="text-sm text-fg-primary flex-1">{b.name}</span>
                      <ArrowRight size={13} strokeWidth={1.5} className="text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            <div className="px-8 py-6">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary mb-4">
                Участники {accepted.length}
                {pending.length > 0 && (
                  <span className="ml-2 text-fg-subtle">{pending.length} ждут</span>
                )}
              </p>

              {projectMembers.length === 0 ? (
                <p className="text-xs font-mono text-fg-subtle mb-4">Загрузка…</p>
              ) : (
                <div className="flex flex-col mb-5">
                  {[...accepted, ...pending].map((m, i, arr) => {
                    const isPending = m.status === 'pending'
                    const isYou = m.id === currentUser?.id
                    const isOwner = m.id === project.ownerId
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 py-3 ${i < arr.length - 1 ? 'hairline-b' : ''}`}
                      >
                        {isPending ? (
                          <div className="w-7 h-7 grid place-items-center hairline text-fg-subtle flex-shrink-0">
                            <Mail size={12} strokeWidth={1.5} />
                          </div>
                        ) : (
                          <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="sm" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate flex items-center gap-1.5 ${isPending ? 'text-fg-muted italic' : 'text-fg-primary'}`}>
                            {m.name}
                            {isOwner && (
                              <Crown size={11} strokeWidth={2} className="text-fg-primary flex-shrink-0" />
                            )}
                          </p>
                          <p className="text-xs font-mono text-fg-muted truncate mt-0.5">{m.email}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {isPending ? (
                            <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle">Ждёт</span>
                          ) : isOwner ? (
                            <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle">
                              {ROLE_LABELS[m.role] ?? m.role}
                            </span>
                          ) : (
                            <InlineRolePicker
                              role={m.role}
                              onChange={role => updateMemberRole(m.id, role)}
                              disabled={!perms.canManageMembers || isYou}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {perms.canManageMembers && (
                <div className="hairline-t pt-4">
                  <button
                    onClick={() => setShowInvite(true)}
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-fg-muted hover:text-fg-primary transition-colors"
                  >
                    <UserPlus size={13} strokeWidth={1.5} />
                    Добавить участника
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* ── Footer ───────────────────────────────── */}
          <div className="flex items-center justify-between px-8 py-5 hairline-t bg-surface-1 flex-shrink-0">
            {perms.isOwner ? (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="text-xs font-mono uppercase tracking-[0.14em] text-fg-subtle hover:text-[#E5484D] transition-colors"
              >
                Удалить проект
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={handleGoToBoard}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-fg-primary text-bg text-sm font-medium hover:opacity-90 transition-opacity rounded-md"
            >
              Перейти на доску
              <ArrowRight size={14} strokeWidth={1.75} />
            </button>
          </div>

        </div>
      </div>

      {showConfirmDelete && (
        <ConfirmDialog
          title="Удалить проект?"
          message={`«${project.name}» и все его доски, колонки и задачи будут удалены без возможности восстановления.`}
          confirmLabel="Удалить"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirmDelete(false)}
          danger
        />
      )}

      {showInvite && (
        <InviteMemberModal
          projectId={project.id}
          onClose={() => {
            setShowInvite(false)
            loadMembers(project.id)
          }}
        />
      )}
    </>
  )
}
