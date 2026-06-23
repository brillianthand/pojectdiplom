import { useState, useRef, useEffect } from 'react'
import { X, Mail } from 'lucide-react'
import { useStore } from '../../store/useStore'
import {
  ALL_ROLES,
  ROLE_ADMIN,
  ROLE_LABELS,
  ROLE_HINTS,
  usePermissions,
} from '../../lib/permissions'

const ERROR_MESSAGES = {
  'user not found':          'Пользователь с таким email не зарегистрирован',
  'user already in project': 'Этот участник уже в проекте',
  'invalid role':            'Неверная роль',
  'forbidden':               'Недостаточно прав',
  'only admins can assign the admin role': 'Только администратор может назначить роль администратора',
}

export function InviteMemberModal({ onClose, projectId }) {
  const inviteMember = useStore(s => s.inviteMember)
  const perms = usePermissions(projectId)
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState(null)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState(null)
  const emailRef = useRef(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  // Hide the admin option from non-admins so they cannot pick a role the API will reject.
  const availableRoles = ALL_ROLES.filter(r => r !== ROLE_ADMIN || perms.canAssignAdmin)

  const submit = async (e) => {
    e?.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !role || busy) return
    setBusy(true); setError(null)
    try {
      let m
      if (projectId) {
        const prev = useStore.getState().activeProjectId
        useStore.setState({ activeProjectId: projectId })
        m = await inviteMember(trimmed, role)
        useStore.setState({ activeProjectId: prev })
      } else {
        m = await inviteMember(trimmed, role)
      }
      if (m) {
        onClose()
      } else {
        const raw = useStore.getState().apiError
        setError(ERROR_MESSAGES[raw] ?? raw ?? 'Не удалось отправить приглашение')
        useStore.getState().dismissError()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div className="w-full max-w-[460px] bg-surface-1 hairline-strong rounded-md overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 hairline-b">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-subtle">Действие</p>
            <h2 className="text-base font-display-tight text-fg-primary mt-0.5">Пригласить участника</h2>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg-primary p-1">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-5">

          {/* Email */}
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted block mb-2">
              Email участника
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="email@example.com"
                className="w-full bg-surface-2 hairline pl-9 pr-3 h-10 text-sm font-mono text-fg-primary placeholder:text-fg-subtle outline-none focus:hairline-strong transition-colors"
              />
            </div>
            <p className="text-xs font-mono text-fg-subtle mt-1.5">
              Можно пригласить только зарегистрированного пользователя
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted block mb-2">
              Роль
            </label>
            <div className="flex flex-col gap-0 hairline">
              {availableRoles.map((r, i) => {
                const active = role === r
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      i > 0 ? 'hairline-t' : ''
                    } ${active ? 'bg-surface-3' : 'bg-surface-2 hover:bg-surface-3/40'}`}
                  >
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${active ? 'bg-fg-primary' : 'hairline-strong'}`} />
                    <span className="flex-1">
                      <span className="block text-sm text-fg-primary">{ROLE_LABELS[r]}</span>
                      <span className="block text-xs font-mono text-fg-subtle mt-0.5">{ROLE_HINTS[r]}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 hairline bg-surface-2 text-xs font-mono text-danger">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 hairline-strong text-xs font-mono uppercase tracking-[0.14em] text-fg-muted hover:bg-surface-3 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!email.trim() || !role || busy}
              className="h-9 px-4 bg-fg-primary text-bg text-xs font-mono uppercase tracking-[0.14em] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {busy ? 'Отправка…' : 'Пригласить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
