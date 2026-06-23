import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Plus, Mail, ChevronDown } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'
import { ROLE_LABELS, ROLE_HINTS } from '../../lib/permissions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MEMBER_ROLES = ['executor', 'manager', 'observer']

const TEMPLATES = [
  { id: 'kanban', label: 'Kanban', columns: ['К выполнению', 'В работе', 'На проверке', 'Готово'] },
  { id: 'scrum',  label: 'Scrum',  columns: ['Бэклог', 'К выполнению', 'В работе', 'На проверке', 'Готово'] },
  { id: 'custom', label: 'Custom', columns: [] },
]

const DEFAULT_CUSTOM_COLUMNS = ['Колонка 1', 'Колонка 2', 'Колонка 3']

function pluralColumns(n) {
  const mod10  = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'колонка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'колонки'
  return 'колонок'
}

export function CreateProjectModal({ onClose }) {
  const { createProject, loadUsers, users, currentUser } = useStore()

  const [name, setName]               = useState('')
  const [template, setTemplate]       = useState('kanban')
  const [customColumns, setCustomColumns] = useState(DEFAULT_CUSTOM_COLUMNS)
  const [query, setQuery]             = useState('')
  const [picked, setPicked]           = useState([])
  const [loading, setLoading]         = useState(false)
  const [openRoleIdx, setOpenRoleIdx] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
    loadUsers()
  }, [])

  useEffect(() => {
    if (openRoleIdx === null) return
    const close = () => setOpenRoleIdx(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openRoleIdx])

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const pickedIds    = new Set(picked.filter(p => p.kind === 'user').map(p => p.id))
    const pickedEmails = new Set(picked.filter(p => p.kind === 'email').map(p => p.email.toLowerCase()))
    return users
      .filter(u => u.id !== currentUser?.id && !pickedIds.has(u.id))
      .filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
      )
      .filter(u => !pickedEmails.has(u.email.toLowerCase()))
      .slice(0, 5)
  }, [query, users, picked, currentUser])

  const trimmed        = query.trim()
  const looksLikeEmail = EMAIL_RE.test(trimmed)
  const showInvite     = looksLikeEmail
    && !candidates.some(u => u.email.toLowerCase() === trimmed.toLowerCase())
    && !picked.some(p => (p.email ?? '').toLowerCase() === trimmed.toLowerCase())
    && trimmed.toLowerCase() !== currentUser?.email?.toLowerCase()

  const addUser = (u) => {
    setPicked(p => [...p, { kind: 'user', id: u.id, name: u.name, email: u.email, initials: u.initials, color: u.color }])
    setQuery('')
  }

  const addEmail = (email) => {
    setPicked(p => [...p, { kind: 'email', email, role: 'executor' }])
    setQuery('')
  }

  const remove = (idx) => setPicked(p => p.filter((_, i) => i !== idx))

  const setMemberRole = (idx, role) => {
    setPicked(p => p.map((entry, i) => i === idx ? { ...entry, role } : entry))
    setOpenRoleIdx(null)
  }

  const onSearchKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (candidates.length > 0) addUser(candidates[0])
      else if (showInvite)       addEmail(trimmed)
    }
    if (e.key === 'Backspace' && !query && picked.length > 0) {
      remove(picked.length - 1)
    }
  }

  const updateColumn = (idx, val) => setCustomColumns(cols => cols.map((c, i) => i === idx ? val : c))
  const addColumn    = () => setCustomColumns(cols => [...cols, `Колонка ${cols.length + 1}`])
  const removeColumn = (idx) => setCustomColumns(cols => cols.filter((_, i) => i !== idx))

  const validCustomCols = customColumns.filter(c => c.trim())
  const canCreate = name.trim() && (template !== 'custom' || validCustomCols.length > 0)

  const handleCreate = async () => {
    if (!canCreate) return
    setLoading(true)
    const memberIds    = picked.filter(p => p.kind === 'user').map(p => p.id)
    const inviteEmails = picked.filter(p => p.kind === 'email').map(p => ({ email: p.email, role: p.role }))
    await createProject({
      name: name.trim(),
      template,
      memberIds,
      inviteEmails,
      customColumns: template === 'custom' ? validCustomCols : [],
    })
    setLoading(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div className="w-full max-w-[560px] bg-surface-2 hairline-strong rounded-lg shadow-[0_24px_60px_-12px_rgba(0,0,0,0.18)] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-baseline justify-between px-8 pt-8 pb-6 hairline-b flex-shrink-0">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary mb-3">
              Новый проект
            </p>
            <h2 className="text-3xl font-display-tight text-fg-primary leading-none">
              Создать проект
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-fg-muted hover:text-fg-primary transition-colors -mt-1"
            aria-label="Закрыть"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col">

          {/* — Name — */}
          <section className="px-8 py-6 hairline-b">
            <label className="grid grid-cols-[100px_1fr] gap-6 items-baseline">
              <span className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">
                Название
              </span>
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="напр. Маркетинг Q3"
                className="
                  w-full bg-transparent border-0 border-b border-fg-subtle/40
                  px-0 py-2.5 text-lg text-fg-primary placeholder:text-fg-subtle
                  outline-none focus:border-fg-primary transition-colors
                "
              />
            </label>
          </section>

          {/* — Template — */}
          <section className="px-8 py-6 hairline-b">
            <div className="grid grid-cols-[100px_1fr] gap-6">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary pt-1">
                Шаблон
              </p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map(t => {
                    const active = template === t.id
                    const previewCols = t.id === 'custom'
                      ? (customColumns.length > 0 ? customColumns : ['…'])
                      : t.columns
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={`
                          flex flex-col gap-2.5 p-3 text-left transition-colors rounded-sm
                          ${active ? 'hairline-strong bg-surface-3' : 'hairline hover:bg-surface-3'}
                        `}
                      >
                        <div className="flex gap-1 h-7">
                          {previewCols.map((c, i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-xs ${active ? 'bg-fg-primary' : 'bg-fg-subtle/40'}`}
                              style={{ opacity: active ? (0.4 + (i / Math.max(previewCols.length, 1)) * 0.6) : 1 }}
                              title={c}
                            />
                          ))}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-fg-primary leading-tight">{t.label}</span>
                          <span className="text-xs font-mono text-fg-subtle">
                            {t.id === 'custom'
                              ? (customColumns.length > 0
                                  ? `${customColumns.length} ${pluralColumns(customColumns.length)}`
                                  : 'настройте')
                              : `${t.columns.length} ${pluralColumns(t.columns.length)}`
                            }
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Custom columns editor */}
                {template === 'custom' && (
                  <div className="flex flex-col gap-2 pt-1">
                    {customColumns.map((col, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-fg-subtle w-4 text-right select-none">{idx + 1}</span>
                        <input
                          value={col}
                          onChange={e => updateColumn(idx, e.target.value)}
                          placeholder={`Колонка ${idx + 1}`}
                          className="
                            flex-1 bg-transparent border-b border-fg-subtle/40
                            px-0 py-1.5 text-sm text-fg-primary placeholder:text-fg-subtle
                            outline-none focus:border-fg-primary transition-colors
                          "
                        />
                        {customColumns.length > 1 && (
                          <button
                            onClick={() => removeColumn(idx)}
                            className="text-fg-subtle hover:text-fg-primary transition-colors flex-shrink-0"
                          >
                            <X size={13} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addColumn}
                      className="flex items-center gap-1.5 text-xs font-mono text-fg-muted hover:text-fg-primary transition-colors mt-1 self-start"
                    >
                      <Plus size={13} strokeWidth={1.5} />
                      Добавить колонку
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* — Members — */}
          <section className="px-8 py-6">
            <div className="grid grid-cols-[100px_1fr] gap-6">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-primary">
                  Участники
                </p>
                <p className="text-xs font-mono text-fg-subtle mt-2">
                  {picked.length === 0 ? 'по желанию' : `добавлено: ${picked.length}`}
                </p>
              </div>

              <div className="flex flex-col gap-4 min-w-0">

                {/* Picked chips */}
                {picked.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {picked.map((p, i) => (
                      <Chip
                        key={i}
                        entry={p}
                        isRoleOpen={openRoleIdx === i}
                        onRoleToggle={() => setOpenRoleIdx(openRoleIdx === i ? null : i)}
                        onRoleSelect={(role) => setMemberRole(i, role)}
                        onRemove={() => remove(i)}
                      />
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={onSearchKey}
                    placeholder="Поиск по имени или приглашение по email"
                    className="
                      w-full bg-transparent border-0 border-b border-fg-subtle/40
                      px-0 py-2.5 text-base text-fg-primary placeholder:text-fg-subtle
                      outline-none focus:border-fg-primary transition-colors
                    "
                  />

                  {(candidates.length > 0 || showInvite) && (
                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-surface-2 hairline-strong rounded-md shadow-lg z-10 max-h-[240px] overflow-y-auto">
                      {candidates.map(u => (
                        <button
                          key={u.id}
                          onClick={() => addUser(u)}
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-surface-3 text-left transition-colors"
                        >
                          <Avatar initials={u.initials} color={u.color} avatarUrl={u.avatarUrl} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-base text-fg-primary truncate">{u.name}</p>
                            <p className="text-xs font-mono text-fg-muted truncate mt-0.5">{u.email}</p>
                          </div>
                          <Plus size={16} strokeWidth={1.5} className="text-fg-subtle" />
                        </button>
                      ))}
                      {showInvite && (
                        <button
                          onClick={() => addEmail(trimmed)}
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-surface-3 text-left transition-colors hairline-t"
                        >
                          <div className="w-8 h-8 flex items-center justify-center hairline-strong rounded-xs">
                            <Mail size={15} strokeWidth={1.5} className="text-fg-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base text-fg-primary truncate">Пригласить по email</p>
                            <p className="text-xs font-mono text-fg-muted truncate mt-0.5">{trimmed}</p>
                          </div>
                          <span className="text-xs font-mono uppercase tracking-wider text-fg-subtle">ждёт</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 hairline-t bg-surface-1">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-base text-fg-secondary hover:text-fg-primary transition-colors rounded-md"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || loading}
            className="
              px-6 py-2.5 text-base font-medium text-white bg-accent rounded-md
              hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {loading ? 'Создание…' : 'Создать проект'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Chip({ entry, isRoleOpen, onRoleToggle, onRoleSelect, onRemove }) {
  const isEmail = entry.kind === 'email'
  return (
    <span
      className={`
        group inline-flex items-center gap-2 pl-2 pr-2 py-1.5
        hairline-strong rounded-full text-sm
        ${isEmail ? 'bg-surface-3' : 'bg-surface-2'}
      `}
    >
      {isEmail ? (
        <span className="w-6 h-6 flex items-center justify-center bg-surface-1 hairline rounded-full flex-shrink-0">
          <Mail size={13} strokeWidth={1.5} className="text-fg-secondary" />
        </span>
      ) : (
        <Avatar initials={entry.initials} color={entry.color} avatarUrl={entry.avatarUrl} size="sm" />
      )}
      <span className="text-fg-primary">
        {isEmail ? entry.email : entry.name}
      </span>
      {isEmail ? (
        <div className="relative" onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={onRoleToggle}
            className="flex items-center gap-0.5 text-xs font-mono text-fg-muted hover:text-fg-primary transition-colors px-1"
          >
            {ROLE_LABELS[entry.role] ?? 'Исполнитель'}
            <ChevronDown size={10} strokeWidth={2} className="flex-shrink-0" />
          </button>
          {isRoleOpen && (
            <div className="absolute left-0 bottom-full mb-1 bg-surface-1 hairline-strong rounded shadow-lg z-20 min-w-[150px]">
              {MEMBER_ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => onRoleSelect(r)}
                  className={`
                    w-full text-left px-3 py-2 transition-colors hover:bg-surface-3
                    ${entry.role === r ? 'bg-surface-2' : ''}
                  `}
                >
                  <span className={`block text-xs font-mono ${entry.role === r ? 'text-fg-primary' : 'text-fg-muted'}`}>
                    {ROLE_LABELS[r]}
                  </span>
                  <span className="block text-[10px] font-mono text-fg-subtle mt-0.5">{ROLE_HINTS[r]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="text-xs font-mono text-fg-subtle pr-1">участник</span>
      )}
      <button
        onClick={onRemove}
        className="text-fg-subtle hover:text-fg-primary transition-colors"
        aria-label="Удалить"
      >
        <X size={13} strokeWidth={1.5} />
      </button>
    </span>
  )
}
