import { useState, useRef, useEffect } from 'react'
import {
  Plus, ChevronLeft, ChevronRight,
  ListTodo, Bell, BarChart2, Users,
  Pencil, Trash2, Check, X, Home, Archive,
  Settings, HelpCircle, Shield,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { CreateProjectModal } from '../project/CreateProjectModal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ArchivePanel } from '../board/ArchivePanel'
import { Toast } from '../ui/Toast'
import { usePermissions } from '../../lib/permissions'

const NAV = [
  { id: 'workspace',     Icon: Home,            label: 'Пространство' },
  { id: 'my-tasks',      Icon: ListTodo,        label: 'Мои задачи' },
  { id: 'notifications', Icon: Bell,            label: 'Уведомления' },
  { id: 'members',       Icon: Users,           label: 'Участники' },
  { id: 'reports',       Icon: BarChart2,       label: 'Отчёты' },
]

const navItem =
  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors duration-150 select-none'
const navItemInactive =
  'text-sidebar-fg-secondary hover:bg-sidebar-surface hover:text-sidebar-fg-primary'
const navItemActive =
  'bg-sidebar-surface-hover text-sidebar-fg-primary font-medium'

function ProjectMenu({ project, onClose, collapsed }) {
  const { updateProject, deleteProject } = useStore()
  const perms = usePermissions(project.id)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(project.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (confirmDelete) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [confirmDelete, onClose])

  const handleRename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== project.name) updateProject(project.id, { name: trimmed })
    onClose()
  }

  if (confirmDelete) {
    return (
      <ConfirmDialog
        title={`Удалить проект «${project.name}»?`}
        message="Все доски и задачи проекта будут удалены безвозвратно."
        danger
        onConfirm={() => { deleteProject(project.id); onClose() }}
        onCancel={() => setConfirmDelete(false)}
      />
    )
  }

  return (
    <div
      ref={ref}
      className={`absolute z-50 bg-surface-2 border border-line-strong rounded-md shadow-xl shadow-black/10 py-1 min-w-[170px] ${
        collapsed ? 'left-full top-0 ml-2' : 'left-full top-0 ml-1'
      }`}
    >
      {renaming ? (
        <div className="px-2 py-1.5 flex gap-1">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') onClose()
            }}
            className="flex-1 text-sm bg-surface-3 border border-line-strong rounded px-2 py-0.5 outline-none text-fg-primary min-w-0 focus:border-line-accent"
          />
          <button onClick={handleRename} className="p-1 rounded text-accent hover:bg-surface-3 transition-colors">
            <Check size={13} strokeWidth={2} />
          </button>
          <button onClick={onClose} className="p-1 rounded text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <>
          {perms.canManageProject && (
            <button
              onClick={() => setRenaming(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Переименовать
            </button>
          )}
          {perms.isOwner && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger-soft transition-colors"
            >
              <Trash2 size={13} strokeWidth={1.75} />
              Удалить проект
            </button>
          )}
          {!perms.canManageProject && !perms.isOwner && (
            <div className="px-3 py-2 text-xs font-mono text-fg-subtle">Нет действий</div>
          )}
        </>
      )}
    </div>
  )
}

export function Sidebar() {
  const { projects, activeProjectId, setActiveProject, view, setView, unreadCount, currentUser } = useStore()
  const isAdmin = !!currentUser?.isAdmin
  const [collapsed, setCollapsed] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [helpToast, setHelpToast] = useState('')

  const activeProject = projects.find(p => p.id === activeProjectId)

  const w = collapsed ? 'w-14' : 'w-56'

  return (
    <>
      <aside
        className={`${w} flex-shrink-0 h-screen flex flex-col bg-sidebar-bg transition-[width] duration-200 overflow-hidden`}
      >
        {/* Logo + collapse */}
        <div className="h-12 flex items-center px-3 gap-2 flex-shrink-0 border-b border-sidebar-line">
          {!collapsed && (
            <>
              {/* LOGO_PLACEHOLDER: вставьте сюда логотип (SVG) */}
              <span className="font-semibold text-sidebar-fg-primary text-base truncate">Kanri</span>
            </>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-6 h-6 grid place-items-center rounded text-sidebar-fg-muted hover:text-sidebar-fg-primary hover:bg-sidebar-surface-hover transition-colors flex-shrink-0 ml-auto"
            title={collapsed ? 'Развернуть' : 'Свернуть'}
          >
            {collapsed
              ? <ChevronRight size={14} strokeWidth={1.75} />
              : <ChevronLeft  size={14} strokeWidth={1.75} />}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-0.5 px-2">

          {/* Nav */}
          {NAV.map(({ id, Icon, label }) => {
            const badge = id === 'notifications' ? unreadCount : 0
            const active = view === id
            return (
              <button
                key={id}
                onClick={() => setView(view === id ? 'board' : id)}
                title={collapsed ? label : undefined}
                className={`${navItem} ${active ? navItemActive : navItemInactive} ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <Icon size={15} strokeWidth={1.75} />
                  {badge > 0 && collapsed && (
                    <span className="absolute -top-1 -right-1 min-w-3 h-3 px-0.5 grid place-items-center bg-accent text-white rounded-full text-[8px] font-display-tight tabular-nums">
                      {badge > 9 ? '9' : badge}
                    </span>
                  )}
                </div>
                {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
                {!collapsed && badge > 0 && (
                  <span className="min-w-4 h-4 px-1 grid place-items-center bg-accent text-white rounded-full text-[10px] font-display-tight tabular-nums">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}

          <div className="my-2 h-px bg-sidebar-line" />

          {/* Projects header */}
          {!collapsed && (
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-2xs font-medium text-sidebar-fg-muted uppercase tracking-wider">Проекты</span>
              <button
                onClick={() => setShowCreate(true)}
                className="w-5 h-5 grid place-items-center rounded text-sidebar-fg-muted hover:text-sidebar-fg-primary hover:bg-sidebar-surface-hover transition-colors"
                title="Новый проект"
              >
                <Plus size={12} strokeWidth={2} />
              </button>
            </div>
          )}

          {collapsed ? (
            <button
              onClick={() => setShowCreate(true)}
              title="Новый проект"
              className={`${navItem} ${navItemInactive} justify-center`}
            >
              <Plus size={15} strokeWidth={1.75} />
            </button>
          ) : (
            projects.filter(p => p.status !== 'completed').map(project => {
              const active = activeProjectId === project.id
              return (
                <div key={project.id} className="relative">
                  <button
                    onClick={() => setActiveProject(project.id)}
                    title={collapsed ? project.name : undefined}
                    className={`${navItem} ${active ? navItemActive : navItemInactive}`}
                  >
                    <span className="flex-1 text-left truncate">{project.name}</span>
                    {active && openMenu !== project.id && (
                      <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
                    )}
                  </button>

                  {openMenu === project.id && (
                    <ProjectMenu
                      project={project}
                      collapsed={collapsed}
                      onClose={() => setOpenMenu(null)}
                    />
                  )}
                </div>
              )
            })
          )}

          {activeProject?.activeBoardId && (
            <>
              <div className="my-2 h-px bg-sidebar-line" />
              <button
                onClick={() => setArchiveOpen(true)}
                title={collapsed ? 'Архив' : undefined}
                className={`${navItem} ${navItemInactive} ${collapsed ? 'justify-center' : ''}`}
              >
                <Archive size={15} strokeWidth={1.75} className="flex-shrink-0" />
                {!collapsed && <span className="flex-1 text-left">Архив</span>}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-sidebar-line px-2 py-2 flex flex-col gap-0.5">
          {isAdmin && (
            <button
              onClick={() => setView(view === 'admin' ? 'board' : 'admin')}
              title={collapsed ? 'Админ-панель' : undefined}
              className={`${navItem} ${view === 'admin' ? navItemActive : navItemInactive} ${collapsed ? 'justify-center' : ''}`}
            >
              <Shield size={15} strokeWidth={1.75} className="flex-shrink-0" />
              {!collapsed && <span className="flex-1 text-left">Админ-панель</span>}
            </button>
          )}
          <button
            onClick={() => setView(view === 'settings' ? 'board' : 'settings')}
            title={collapsed ? 'Настройки' : undefined}
            className={`${navItem} ${view === 'settings' ? navItemActive : navItemInactive} ${collapsed ? 'justify-center' : ''}`}
          >
            <Settings size={15} strokeWidth={1.75} className="flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Настройки</span>}
          </button>
          <button
            onClick={() => setHelpToast('Раздел «Помощь» появится позже')}
            title={collapsed ? 'Помощь' : undefined}
            className={`${navItem} ${navItemInactive} ${collapsed ? 'justify-center' : ''}`}
          >
            <HelpCircle size={15} strokeWidth={1.75} className="flex-shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Помощь</span>}
          </button>
        </div>
      </aside>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      {archiveOpen && activeProject?.activeBoardId && (
        <ArchivePanel boardId={activeProject.activeBoardId} onClose={() => setArchiveOpen(false)} />
      )}
      <Toast message={helpToast} type="success" onDismiss={() => setHelpToast('')} />
    </>
  )
}
