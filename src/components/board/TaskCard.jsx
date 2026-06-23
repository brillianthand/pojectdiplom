import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, Check, Copy, ListChecks, MessageSquare, MoreHorizontal, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { Tag, colorsForTags } from '../ui/Badge'
import { AvatarGroup } from '../ui/AvatarGroup'
import { PriorityBadge } from '../ui/PriorityIcon'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useStore } from '../../store/useStore'
import { formatDateRelative, isOverdue } from '../../utils/date'
import { usePermissions } from '../../lib/permissions'

const EMPTY_MEMBERS = []

export function TaskCard({ task, columnId }) {
  const setActiveTask = useStore(s => s.setActiveTask)
  const toggleTaskComplete = useStore(s => s.toggleTaskComplete)
  const duplicateTask = useStore(s => s.duplicateTask)
  const activeProjectId = useStore(s => s.activeProjectId)
  const members = useStore(s => s.members[activeProjectId]) ?? EMPTY_MEMBERS

  const archiveTask = useStore(s => s.archiveTask)
  const deleteTask = useStore(s => s.deleteTask)
  const updateTask = useStore(s => s.updateTask)
  const addSubtask = useStore(s => s.addSubtask)
  const starredIds = useStore(s => s.starredIds)
  const toggleStar = useStore(s => s.toggleStar)
  const isStar = starredIds.has(task.id)
  const perms = usePermissions()
  const [menuOpen, setMenuOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menuOpen])

  const openMenu = (e) => {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); return }
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const menuW = 180
      const menuH = 196
      const margin = 6
      const top = r.bottom + margin + menuH > window.innerHeight
        ? r.top - margin - menuH
        : r.bottom + margin
      let left = r.left + margin
      if (left + menuW > window.innerWidth - 8) {
        left = window.innerWidth - menuW - 8
      }
      setMenuPos({ top, left: Math.max(8, left) })
    }
    setMenuOpen(true)
  }

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { columnId },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const due = task.dueDate ? { label: formatDateRelative(task.dueDate), overdue: isOverdue(task.dueDate) } : null
  const subtasks = task.subtasks || []
  const subtasksDone = subtasks.filter(s => s.completed).length
  const subtasksAllDone = subtasks.length > 0 && subtasksDone === subtasks.length

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer select-none ${
        task.completed
          ? 'bg-surface-3/60 border-line/60 opacity-70'
          : 'bg-surface-2 border-line'
      }`}
      onClick={() => setActiveTask(task.id)}
    >
      <div className="p-4">
        <div className="flex items-start gap-2">
          <button
            onClick={e => { e.stopPropagation(); if (perms.canEditTasks) toggleTaskComplete(task.id) }}
            onPointerDown={e => e.stopPropagation()}
            disabled={!perms.canEditTasks}
            title={task.completed ? 'Отметить активной' : 'Завершить задачу'}
            className={`flex-shrink-0 mt-0.5 flex w-4 h-4 rounded-full items-center justify-center transition-all ${task.completed ? 'bg-emerald-500' : 'hover:bg-slate-200'} ${!perms.canEditTasks ? 'opacity-50 cursor-default' : ''}`}
            style={task.completed ? {} : { boxShadow: 'inset 0 0 0 1.5px #94a3b8' }}
          >
            <Check size={9} strokeWidth={3} className={task.completed ? 'text-white' : 'text-slate-400'} />
          </button>
          {renaming ? (
            <div
              className="flex-1 flex flex-col gap-1"
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
            >
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => {
                  if (renameValue.trim() && renameValue !== task.title) updateTask(task.id, { title: renameValue.trim() })
                  setRenaming(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (renameValue.trim() && renameValue !== task.title) updateTask(task.id, { title: renameValue.trim() })
                    setRenaming(false)
                  }
                  if (e.key === 'Escape') { setRenaming(false) }
                }}
                className="w-full text-sm bg-surface-3 border border-line-strong rounded-md px-2 py-1 outline-none text-fg-primary"
              />
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={e => {
                    e.preventDefault()
                    if (renameValue.trim() && renameValue !== task.title) updateTask(task.id, { title: renameValue.trim() })
                    setRenaming(false)
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-accent hover:bg-accent-hover text-white transition-colors"
                >
                  <Check size={10} strokeWidth={2.5} /> Сохранить
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); setRenaming(false) }}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
                >
                  <X size={10} strokeWidth={2} /> Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className={`text-sm leading-snug flex-1 ${task.completed ? 'line-through text-fg-muted' : 'text-fg-primary'}`}>
              {task.title}
            </p>
          )}

          {/* Звезда + три точки */}
          <div className="flex-shrink-0 flex items-center gap-0.5">
            <button
              onClick={e => { e.stopPropagation(); toggleStar(task.id) }}
              onPointerDown={e => e.stopPropagation()}
              title={isStar ? 'Убрать из избранного' : 'В избранное'}
              className={`p-0.5 rounded transition-all ${
                isStar
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <Star size={13} strokeWidth={1.75} className={isStar ? 'text-yellow-400 fill-yellow-400' : 'text-fg-subtle hover:text-yellow-400'} />
            </button>
          {perms.canEditTasks && (
            <>
            <button
              ref={triggerRef}
              onClick={openMenu}
              onPointerDown={e => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-all"
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && createPortal(
              <div
                ref={menuRef}
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 180 }}
                className="z-[100] bg-surface-1 border border-line rounded-lg shadow-lg py-1"
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              >
                <button
                  onClick={() => { setMenuOpen(false); setRenameValue(task.title); setRenaming(true) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-2 transition-colors"
                >
                  <Pencil size={13} />
                  Переименовать
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setAddingSubtask(true) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-2 transition-colors"
                >
                  <Plus size={13} />
                  Подзадача
                </button>
                <button
                  onClick={() => {
                    if (duplicating) return
                    setMenuOpen(false)
                    setDuplicating(true)
                    duplicateTask(task.id).finally(() => setDuplicating(false))
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-2 transition-colors"
                >
                  <Copy size={13} />
                  {duplicating ? 'Дублирую…' : 'Дублировать'}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); archiveTask(task.id) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-2 transition-colors"
                >
                  <Archive size={13} />
                  В архив
                </button>
                <div className="my-1 border-t border-line" />
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger-soft transition-colors"
                >
                  <Trash2 size={13} />
                  Удалить
                </button>
              </div>,
              document.body,
            )}
            </>
          )}
          </div>
        </div>

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {colorsForTags(task.tags).map((color, i) => (
              <Tag key={task.tags[i]} label={task.tags[i]} color={color} />
            ))}
          </div>
        )}

        {addingSubtask && (
          <div
            className="mt-2.5 flex items-center gap-1.5"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <input
              autoFocus
              value={subtaskDraft}
              onChange={e => setSubtaskDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const v = subtaskDraft.trim()
                  if (v) addSubtask(task.id, v)
                  setSubtaskDraft('')
                  setAddingSubtask(false)
                }
                if (e.key === 'Escape') { setSubtaskDraft(''); setAddingSubtask(false) }
              }}
              onBlur={() => {
                const v = subtaskDraft.trim()
                if (v) addSubtask(task.id, v)
                setSubtaskDraft('')
                setAddingSubtask(false)
              }}
              placeholder="Подзадача..."
              className="flex-1 min-w-0 text-xs bg-surface-1 border border-line-strong rounded-md px-2 py-1 outline-none text-fg-primary placeholder:text-fg-muted"
            />
            <button
              onClick={() => { setSubtaskDraft(''); setAddingSubtask(false) }}
              onPointerDown={e => e.stopPropagation()}
              className="p-0.5 rounded text-fg-muted hover:text-fg-primary"
              title="Отмена"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5">
            {task.priority && <PriorityBadge priority={task.priority} />}
          </div>

          <div className="flex items-center gap-2">
            {subtasks.length > 0 && (
              <span
                className={`flex items-center gap-1 text-sm ${subtasksAllDone ? 'text-emerald-700' : 'text-fg-primary'}`}
                title="Подзадачи"
              >
                <ListChecks size={11} />
                {subtasksDone}/{subtasks.length}
              </span>
            )}
            {task.comments.length > 0 && (
              <span className="flex items-center gap-1 text-sm text-fg-primary">
                <MessageSquare size={11} />
                {task.comments.length}
              </span>
            )}
            {due && (
              <span className={`text-sm ${due.overdue ? 'text-danger' : 'text-fg-primary'}`}>
                {due.label}
              </span>
            )}
            <AvatarGroup
              members={task.assignees.map(id => members.find(m => m.id === id)).filter(Boolean)}
              max={2}
              size="sm"
              ringClass="ring-2 ring-surface-2"
            />
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить задачу?"
          message={`«${task.title}» будет удалена безвозвратно.`}
          danger
          onConfirm={() => { deleteTask(task.id); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
