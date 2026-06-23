import { useState, useRef, useEffect } from 'react'
import {
  Search, Sun, Moon, Plus, LayoutDashboard,
  CalendarDays, List, Filter, ChevronDown,
  X, Check, MoreHorizontal, Trash2, Pencil,
  LogOut, User, Share2, Link, Copy, Settings, Flag,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { api } from '../../api/index'
import { Avatar } from '../ui/Avatar'
import { PriorityIcon, PRIORITIES } from '../ui/PriorityIcon'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { GlobalSearch } from './GlobalSearch'
import { NotificationDropdown } from '../notifications/NotificationDropdown'
import { BoardSettingsModal } from '../board/BoardSettingsModal'
import { usePermissions } from '../../lib/permissions'
const DEADLINES = [
  { value: 'overdue', label: 'Просроченные' },
  { value: 'today',   label: 'Сегодня' },
  { value: 'week',    label: 'Эта неделя' },
]

const VIEW_TITLES = {
  'workspace':     'Рабочее пространство',
  'my-tasks':      'Мои задачи',
  'notifications': 'Уведомления',
  'members':       'Участники',
  'reports':       'Отчёты',
  'settings':      'Настройки',
  'admin':         'Админ-панель',
}

const iconBtn =
  'w-7 h-7 grid place-items-center rounded-md text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors'

const chipBase =
  'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-sm border transition-colors duration-150 select-none'
const chipInactive =
  'bg-surface-3/60 border-black text-black hover:bg-surface-3 hover:border-black'
const chipActive =
  'bg-accent-soft border-line-accent text-accent-fg'

function FilterCheckRow({ selected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
    >
      <span className={`w-3.5 h-3.5 rounded-sm grid place-items-center border transition-colors ${
        selected ? 'bg-accent border-accent' : 'bg-transparent border-line-strong'
      }`}>
        {selected && <Check size={9} strokeWidth={3} className="text-white" />}
      </span>
      <span className="flex-1 flex items-center gap-2 text-left">{children}</span>
    </button>
  )
}

function FilterSection({ label, children }) {
  return (
    <div className="py-2 hairline-b last:hairline-b-0">
      <div className="px-4 pt-1 pb-1.5 text-[10px] font-display-tight tracking-[0.12em] uppercase text-fg-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

const VIEW_OPTIONS = [
  { id: 'board',    Icon: LayoutDashboard, label: 'Доска' },
  { id: 'list',     Icon: List,            label: 'Список' },
  { id: 'calendar', Icon: CalendarDays,    label: 'Календарь' },
]

function ViewDropdown({ view, setView }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = VIEW_OPTIONS.find(v => v.id === view) ?? VIEW_OPTIONS[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`${chipBase} ${chipInactive} shrink-0`}
      >
        <current.Icon size={11} strokeWidth={1.75} />
        {current.label}
        <ChevronDown size={11} strokeWidth={1.75} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-surface-2 hairline-strong rounded-lg shadow-xl z-50 w-44 p-1 overflow-hidden">
          {VIEW_OPTIONS.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => { setView(id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                view === id ? 'bg-surface-3 text-fg-primary' : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3/60'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterPopover({ projectMembers, filters, toggleFilter, toggleDeadline, clearFilters }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const total =
    filters.assignees.length +
    filters.priorities.length +
    (filters.deadline ? 1 : 0)
  const active = total > 0

  return (
    <div ref={ref} className="relative flex items-center gap-2 min-w-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`${chipBase} ${active ? chipActive : chipInactive} shrink-0`}
      >
        <Filter size={11} strokeWidth={1.75} />
        Фильтры
        {active && (
          <span className="min-w-4 h-4 px-1 grid place-items-center bg-accent text-white rounded-full text-[10px] font-display-tight tabular-nums">
            {total}
          </span>
        )}
        <ChevronDown size={11} strokeWidth={1.75} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {active && (
        <button
          onClick={clearFilters}
          className="shrink-0 text-xs text-fg-muted hover:text-danger transition-colors"
        >
          Сбросить
        </button>
      )}

      {open && (
        <div className="absolute top-full mt-2 left-0 bg-surface-2 hairline-strong rounded-md shadow-2xl shadow-black/40 z-50 w-[300px] animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 hairline-b">
            <span className="text-[11px] font-display-tight tracking-[0.14em] uppercase text-fg-primary">
              Фильтры
            </span>
            {active && (
              <button
                onClick={clearFilters}
                className="text-[11px] text-fg-muted hover:text-danger transition-colors"
              >
                Сбросить всё
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <FilterSection label="Исполнитель">
              {projectMembers.length === 0 ? (
                <div className="px-4 py-2 text-xs text-fg-muted">Нет участников</div>
              ) : (
                projectMembers.map(m => (
                  <FilterCheckRow
                    key={m.id}
                    selected={filters.assignees.includes(m.id)}
                    onClick={() => toggleFilter('assignees', m.id)}
                  >
                    <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="sm" />
                    <span className="truncate">{m.name}</span>
                  </FilterCheckRow>
                ))
              )}
            </FilterSection>

            <FilterSection label="Приоритет">
              {PRIORITIES.map(opt => (
                <FilterCheckRow
                  key={opt.value}
                  selected={filters.priorities.includes(opt.value)}
                  onClick={() => toggleFilter('priorities', opt.value)}
                >
                  <PriorityIcon priority={opt.value} size={13} />
                  <span>{opt.label}</span>
                </FilterCheckRow>
              ))}
            </FilterSection>

            <FilterSection label="Дедлайн">
              {DEADLINES.map(opt => (
                <FilterCheckRow
                  key={opt.value}
                  selected={filters.deadline === opt.value}
                  onClick={() => toggleDeadline(opt.value)}
                >
                  <span>{opt.label}</span>
                </FilterCheckRow>
              ))}
            </FilterSection>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileDropdown({ currentUser, theme, setTheme, logout, setView }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="grid place-items-center rounded-full ring-1 ring-transparent hover:ring-line-strong transition-all"
      >
        <Avatar
          initials={currentUser?.initials ?? '?'}
          color={currentUser?.color}
          avatarUrl={currentUser?.avatarUrl}
          size="sm"
        />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-surface-2 hairline-strong rounded-md shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
          {/* Profile head */}
          <div className="flex items-center gap-3 px-4 py-3 hairline-b">
            <Avatar
              initials={currentUser?.initials ?? '?'}
              color={currentUser?.color}
              avatarUrl={currentUser?.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-sm font-display-tight text-fg-primary truncate">{currentUser?.name ?? '—'}</p>
              <p className="text-xs text-fg-muted truncate">{currentUser?.email ?? ''}</p>
            </div>
          </div>

          {/* Items */}
          <div className="py-1">
            <button
              onClick={() => { setView('settings'); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
            >
              <User size={14} strokeWidth={1.75} />
              Профиль
            </button>
            <button
              onClick={() => { setTheme(theme === 'light' ? 'dark' : 'light'); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
            >
              {theme === 'light' ? <Moon size={14} strokeWidth={1.75} /> : <Sun size={14} strokeWidth={1.75} />}
              {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            </button>
          </div>

          <div className="hairline-t py-1">
            <button
              onClick={() => { logout(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-[#E5484D] hover:bg-danger-soft transition-colors"
            >
              <LogOut size={14} strokeWidth={1.75} />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Модалка завершения спринта ──────────────────────────────────────────── */
function CompleteSprintModal({ sprints, onClose, onComplete }) {
  const activeSprints = sprints.filter(s => s.status === 'active')
  const [selected, setSelected] = useState(activeSprints[0]?.id ?? null)
  const [loading, setLoading] = useState(false)
  const sp = activeSprints.find(s => s.id === selected)

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    await onComplete(selected)
    setLoading(false)
    onClose()
  }

  if (!activeSprints.length) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-surface-2 border border-line shadow-2xl w-[420px] animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <span className="text-sm font-semibold text-fg-primary">Завершить спринт</span>
          <button onClick={onClose} className="text-fg-muted hover:text-fg-primary">
            <X size={14} />
          </button>
        </div>

        {/* Sprint selector — показываем если вдруг больше одного */}
        {activeSprints.length > 1 && (
          <div className="px-5 pt-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted block mb-2">Выберите спринт</label>
            <div className="flex flex-col gap-1">
              {activeSprints.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`flex items-center gap-3 px-3 py-2 border text-left transition-colors ${
                    selected === s.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-3'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                    selected === s.id ? 'border-accent bg-accent' : 'border-line-strong'
                  }`} />
                  <span className="text-sm font-medium text-fg-primary">{s.name}</span>
                  <span className="text-xs text-fg-primary ml-auto">{s.completedTasks}/{s.totalTasks}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sprint info */}
        {sp && (
          <div className="px-5 py-4">
            {activeSprints.length === 1 && (
              <p className="text-sm font-medium text-fg-primary mb-3">{sp.name}</p>
            )}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-primary">Выполнено</span>
                <span className="text-xl font-semibold text-fg-primary">{sp.completedTasks}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-primary">Всего</span>
                <span className="text-xl font-semibold text-fg-primary">{sp.totalTasks}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-primary">Не выполнено</span>
                <span className="text-xl font-semibold text-fg-primary">{sp.totalTasks - sp.completedTasks}</span>
              </div>
            </div>

            {sp.totalTasks - sp.completedTasks > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 bg-surface-3 border border-line text-[13px] text-fg-primary">
                <span className="mt-0.5">→</span>
                <span>{sp.totalTasks - sp.completedTasks} незавершённых {sp.totalTasks - sp.completedTasks === 1 ? 'задача вернётся' : 'задач вернутся'} в бэклог</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
          <button onClick={onClose} className="h-8 px-4 text-sm text-fg-primary border border-line hover:bg-surface-3 transition-colors">
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="h-8 px-4 text-sm bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Завершение…' : 'Завершить спринт'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Header() {
  const {
    theme, setTheme, projects, activeProjectId,
    view, setView, filters, setFilters, clearFilters,
    setActiveBoard, addBoard, deleteBoard, renameBoard, searchQuery, setSearchQuery,
    currentUser, members, logout, sprintData, completeSprint,
  } = useStore()
  const isBoardView = ['board', 'calendar', 'list', 'backlog'].includes(view)
  const projectMembers = members[activeProjectId] ?? []
  const perms = usePermissions()

  const project = projects.find(p => p.id === activeProjectId)
  const boards = useStore(s => s.boards)
  const activeBoard = project?.activeBoardId ? boards[project.activeBoardId] : null

  // Спринты активного проекта
  const activeBoardSprints = (project?.activeBoardId && sprintData[project.activeBoardId]?.sprints) ?? []
  const hasActiveSprint = activeBoardSprints.some(s => s.status === 'active')

  const [completeSprintOpen, setCompleteSprintOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shareLink, setShareLink] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addingBoard, setAddingBoard]     = useState(false)
  const [boardName, setBoardName]         = useState('')
  const [boardMenu, setBoardMenu]         = useState(null)
  const [renamingBoard, setRenamingBoard] = useState(null)
  const [renameValue, setRenameValue]     = useState('')
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null)
  const [infoDialog, setInfoDialog] = useState(null)

  useEffect(() => {
    if (!boardMenu) return
    const close = () => setBoardMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [boardMenu])


  const toggleFilter = (key, value) => {
    const current = filters[key]
    setFilters({ [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] })
  }

  const toggleDeadline = (value) => {
    setFilters({ deadline: filters.deadline === value ? null : value })
  }

  return (
    <div className="flex flex-col flex-shrink-0 relative z-40">
      {/* ── Top bar ───────────────────────────────────────── */}
      <div className="h-12 flex items-center gap-3 px-4 bg-surface-1 relative z-20">
        <div className="w-48 flex items-center shrink-0 min-w-0">
          {isBoardView && (
            <span className="font-semibold text-fg-primary text-lg truncate">
              Проект {project?.name}
            </span>
          )}
        </div>

        <div className="flex-1 flex justify-center">
          <button
            onClick={() => setSearchOpen(true)}
            className="relative w-full max-w-sm flex items-center gap-2 h-7 pl-7 pr-3 text-sm bg-surface-2 border border-neutral-900 rounded-md text-fg-muted hover:border-line-strong transition-colors"
          >
            <Search size={13} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <span className="flex-1 text-left truncate">Поиск задач...</span>
          </button>
        </div>

        <div className="w-48 flex items-center gap-1 justify-end shrink-0">
          <NotificationDropdown onOpenFull={() => setView('notifications')} />
          <ProfileDropdown
            currentUser={currentUser}
            theme={theme}
            setTheme={setTheme}
            logout={logout}
            setView={setView}
          />
        </div>
      </div>

      {/* ── Board tabs ───────────────────────────────────── */}
      {isBoardView && (
        <div className="flex items-center gap-0.5 px-3 bg-surface-1 hairline-b min-h-[38px]">
          {project?.boards.map(board => {
            const active = board.id === project.activeBoardId
            return (
              <div key={board.id} className="relative">
                {renamingBoard === board.id ? (
                  <div className="flex items-center gap-1 px-1 py-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameValue.trim()) {
                          renameBoard(board.id, renameValue.trim())
                          setRenamingBoard(null)
                        }
                        if (e.key === 'Escape') setRenamingBoard(null)
                      }}
                      className="px-2 py-1 text-sm bg-surface-2 border border-line-accent rounded-md text-fg-primary outline-none w-32"
                    />
                    <button
                      onMouseDown={e => { e.preventDefault(); if (renameValue.trim()) { renameBoard(board.id, renameValue.trim()); setRenamingBoard(null) } }}
                      className={iconBtn}
                      title="Сохранить"
                    >
                      <Check size={13} strokeWidth={2} className="text-accent" />
                    </button>
                    <button
                      onMouseDown={e => { e.preventDefault(); setRenamingBoard(null) }}
                      className={iconBtn}
                      title="Отмена"
                    >
                      <X size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveBoard(board.id)}
                    className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-md text-sm transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-surface-3 text-fg-primary font-medium'
                        : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3'
                    }`}
                  >
                    {board.name}
                    {perms.canManageBoards && (
                      <span
                        onClick={e => { e.stopPropagation(); setBoardMenu(boardMenu === board.id ? null : board.id) }}
                        className="w-4 h-4 grid place-items-center rounded text-fg-muted hover:text-fg-primary hover:bg-glass-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal size={11} strokeWidth={1.75} />
                      </span>
                    )}
                  </button>
                )}
                {boardMenu === board.id && (
                  <div onMouseDown={e => e.stopPropagation()} className="absolute top-full left-0 mt-1 bg-surface-2 border border-line rounded-md shadow-xl z-50 py-1 min-w-[170px] animate-fade-in">
                    <button
                      onClick={() => { setRenamingBoard(board.id); setRenameValue(board.name); setBoardMenu(null) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                      Переименовать
                    </button>
                    <button
                      onClick={() => {
                        setBoardMenu(null)
                        if (project.boards.length <= 1) {
                          setInfoDialog({ title: 'Нельзя удалить доску', message: 'В проекте должна быть хотя бы одна доска.' })
                          return
                        }
                        setConfirmDeleteBoard(board)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger-soft transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                      Удалить доску
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {perms.canManageBoards && (addingBoard ? (
            <div className="flex items-center gap-1 ml-1">
              <input
                autoFocus
                value={boardName}
                onChange={e => setBoardName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && boardName.trim()) {
                    addBoard(boardName.trim()); setBoardName(''); setAddingBoard(false)
                  }
                  if (e.key === 'Escape') { setAddingBoard(false); setBoardName('') }
                }}
                placeholder="Название..."
                className="px-2 py-1 text-sm bg-surface-2 border border-line rounded-md text-fg-primary placeholder:text-fg-muted outline-none w-32 focus:border-line-strong"
              />
              <button
                onClick={() => { if (boardName.trim()) { addBoard(boardName.trim()); setBoardName(''); setAddingBoard(false) } }}
                disabled={!boardName.trim()}
                className={`${iconBtn} disabled:opacity-30`}
                title="Создать"
              >
                <Check size={13} strokeWidth={2} className="text-accent" />
              </button>
              <button onClick={() => { setAddingBoard(false); setBoardName('') }} className={iconBtn} title="Отмена">
                <X size={13} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingBoard(true)}
              className={`${iconBtn} ml-1`}
              title="Новая доска"
            >
              <Plus size={14} strokeWidth={1.75} />
            </button>
          ))}
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────── */}

      {isBoardView && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-1 hairline-b">
          {/* Backlog tab — only for Scrum boards */}
          {activeBoard?.settings?.scrumEnabled && (
            <>
              <button
                onClick={() => setView('backlog')}
                className={`${chipBase} ${view === 'backlog' ? chipActive : chipInactive} shrink-0`}
              >
                <List size={11} strokeWidth={1.75} />
                Бэклог
              </button>
              <div className="w-px h-4 bg-line mx-1" />
            </>
          )}

          {/* View dropdown */}
          <ViewDropdown view={view} setView={setView} />
          <div className="w-px h-4 bg-line" />

          {/* Filters */}
          <FilterPopover
            projectMembers={projectMembers}
            filters={filters}
            toggleFilter={toggleFilter}
            toggleDeadline={toggleDeadline}
            clearFilters={clearFilters}
          />


          <div className="ml-auto flex items-center gap-1">
            {/* Завершить спринт — только на board-вью со scrum и активным спринтом */}
            {perms.canManageBoards && view === 'board' && activeBoard?.settings?.scrumEnabled && hasActiveSprint && (
              <button
                onClick={() => setCompleteSprintOpen(true)}
                className="h-7 px-2.5 text-[12px] font-medium border border-line text-fg-primary hover:bg-surface-3 transition-colors mr-1"
                title="Завершить активный спринт"
              >
                Завершить спринт
              </button>
            )}
            {perms.canManageBoards && (
              <>
                <button
                  onClick={() => setSettingsOpen(true)}
                  disabled={!activeBoard}
                  className="w-7 h-7 grid place-items-center rounded-md text-black hover:bg-surface-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Настройки доски"
                >
                  <Settings size={14} strokeWidth={1.75} />
                </button>
                <button
                  onClick={async () => {
                    const boardId = project?.activeBoardId
                    if (!boardId) return
                    const data = await api.shareBoard(boardId).catch(() => null)
                    if (!data) return
                    const url = `${window.location.origin}/shared/${data.token}`
                    setShareLink(url)
                    navigator.clipboard?.writeText(url).catch(() => {})
                  }}
                  className="w-7 h-7 grid place-items-center rounded-md text-black hover:bg-surface-3 transition-colors"
                  title="Поделиться доской"
                >
                  <Share2 size={14} strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {settingsOpen && activeBoard && (
        <BoardSettingsModal board={activeBoard} onClose={() => setSettingsOpen(false)} />
      )}

      {shareLink && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-surface-1 border border-line-strong rounded-xl shadow-2xl px-4 py-3 animate-fade-in">
          <Link size={14} className="text-fg-muted flex-shrink-0" />
          <span className="text-sm text-fg-primary max-w-xs truncate">{shareLink}</span>
          <button
            onClick={() => { navigator.clipboard?.writeText(shareLink); setShareLink(null) }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
          >
            <Copy size={11} />
            Скопировать
          </button>
          <button onClick={() => setShareLink(null)} className="text-fg-muted hover:text-fg-primary transition-colors">
            <X size={13} />
          </button>
        </div>
      )}

      {completeSprintOpen && (
        <CompleteSprintModal
          sprints={activeBoardSprints}
          onClose={() => setCompleteSprintOpen(false)}
          onComplete={completeSprint}
        />
      )}

      {confirmDeleteBoard && (
        <ConfirmDialog
          title={`Удалить доску «${confirmDeleteBoard.name}»?`}
          message="Все колонки и задачи этой доски будут удалены безвозвратно."
          danger
          onConfirm={() => { deleteBoard(confirmDeleteBoard.id); setConfirmDeleteBoard(null) }}
          onCancel={() => setConfirmDeleteBoard(null)}
        />
      )}
      {infoDialog && (
        <ConfirmDialog
          title={infoDialog.title}
          message={infoDialog.message}
          danger={false}
          confirmLabel="ОК"
          hideCancel
          onConfirm={() => setInfoDialog(null)}
          onCancel={() => setInfoDialog(null)}
        />
      )}
    </div>
  )
}
