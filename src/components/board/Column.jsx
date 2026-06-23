import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreHorizontal, X, Check, Pencil, Trash2, Search, Eye, EyeOff } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { useStore } from '../../store/useStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { usePermissions } from '../../lib/permissions'

function ColumnMenu({ column, pos, triggerRef, onClose, onStartRename }) {
  const { deleteColumn, hideCompletedColumns, toggleColumnHideCompleted } = useStore()
  const isHidden = hideCompletedColumns.has(column.id)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (confirmDelete) return
    const handler = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef?.current && !triggerRef.current.contains(e.target)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [confirmDelete, onClose, triggerRef])

  if (confirmDelete) {
    return createPortal(
      <ConfirmDialog
        title={`Удалить колонку "${column.title}"?`}
        message="Все задачи в ней будут удалены безвозвратно."
        onConfirm={() => { deleteColumn(column.id); onClose() }}
        onCancel={() => setConfirmDelete(false)}
      />,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: 210 }}
      className="z-[100] bg-surface-1 border border-line rounded-lg shadow-lg py-1"
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        onClick={() => { toggleColumnHideCompleted(column.id); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-2 transition-colors whitespace-nowrap"
      >
        {isHidden ? <Eye size={13} className="flex-shrink-0" /> : <EyeOff size={13} className="flex-shrink-0" />}
        {isHidden ? 'Показать выполненные' : 'Скрыть выполненные'}
      </button>
      <button
        onClick={() => { onStartRename(); onClose() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-2 transition-colors"
      >
        <Pencil size={13} />
        Переименовать
      </button>
      <div className="my-1 border-t border-line" />
      <button
        onClick={() => setConfirmDelete(true)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger-soft transition-colors"
      >
        <Trash2 size={13} />
        Удалить колонку
      </button>
    </div>,
    document.body,
  )
}

export function Column({ column, tasks }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [renaming, setRenaming] = useState(false)
  const [renameTitle, setRenameTitle] = useState(column.title)
  const menuTriggerRef = useRef(null)
  const { addTask, getFilteredTasks, updateColumn, hideCompletedColumns } = useStore()
  const perms = usePermissions()

  const openMenu = (e) => {
    e.stopPropagation()
    if (menuOpen) { setMenuOpen(false); return }
    const r = menuTriggerRef.current?.getBoundingClientRect()
    if (r) {
      const menuW = 210
      const menuH = 124
      const margin = 4
      const top = r.bottom + margin + menuH > window.innerHeight
        ? r.top - margin - menuH
        : r.bottom + margin
      let left = r.right - menuW
      if (left < 8) left = 8
      if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8
      setMenuPos({ top, left })
    }
    setMenuOpen(true)
  }

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

  const handleRename = () => {
    const t = renameTitle.trim()
    if (t && t !== column.title) updateColumn(column.id, { title: t })
    setRenaming(false)
  }
  const allFiltered = getFilteredTasks(tasks)
  const filteredTasks = hideCompletedColumns.has(column.id)
    ? allFiltered.filter(t => !t.completed)
    : allFiltered

  const { setNodeRef: dropRef } = useDroppable({ id: column.id })

  const {
    attributes, listeners, setNodeRef: sortRef,
    transform, transition, isDragging,
  } = useSortable({ id: `col::${column.id}` })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const handleAdd = () => {
    if (draft.trim()) {
      addTask(column.id, draft.trim())
      setDraft('')
      setAdding(false)
    }
  }

  const isEmpty = filteredTasks.length === 0 && !adding
  const isFiltered = tasks.length > 0 && filteredTasks.length === 0

  return (
    <div
      ref={sortRef}
      style={style}
      className="flex flex-col w-80 flex-shrink-0 rounded-xl bg-surface-1 shadow-md overflow-hidden"
    >
      {/* Column header */}
      <div
        className={`px-3 py-2.5 flex items-center justify-between ${perms.canManageBoards ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          backgroundColor: column.color + 'cc',
          backdropFilter: 'blur(8px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)',
        }}
        {...attributes}
        {...(perms.canManageBoards ? listeners : {})}
      >
        {renaming ? (
          <div
            className="flex-1 flex flex-col gap-1.5"
            onPointerDown={e => e.stopPropagation()}
          >
            <input
              autoFocus
              value={renameTitle}
              onChange={e => setRenameTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') { setRenaming(false); setRenameTitle(column.title) }
              }}
              className="text-sm font-semibold bg-surface-2 border border-line-strong rounded-md px-2 py-1 outline-none w-full text-fg-primary"
            />
            <div className="flex items-center gap-1">
              <button
                onMouseDown={e => { e.preventDefault(); handleRename() }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                <Check size={10} strokeWidth={2.5} /> Сохранить
              </button>
              <button
                onMouseDown={e => { e.preventDefault(); setRenaming(false); setRenameTitle(column.title) }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded text-fg-muted hover:text-fg-primary hover:bg-black/10 transition-colors"
              >
                <X size={10} strokeWidth={2} /> Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate" style={{ color: column.textColor }}>
                {column.title}
              </h3>
              <span
                className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0"
                style={{ backgroundColor: column.textColor + '22', color: column.textColor }}
              >
                {filteredTasks.length}
              </span>
            </div>
            {perms.canManageBoards && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  ref={menuTriggerRef}
                  onClick={openMenu}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/10 transition-colors"
                  style={{ color: column.textColor }}
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <ColumnMenu
                    column={column}
                    pos={menuPos}
                    triggerRef={menuTriggerRef}
                    onClose={() => setMenuOpen(false)}
                    onStartRename={() => { setRenameTitle(column.title); setRenaming(true) }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add task row — executor+ only */}
      {perms.canEditTasks && (
        <div
          className="px-3 py-1.5 flex items-center border-b border-black/5"
          style={{ backgroundColor: column.color + 'cc', backdropFilter: 'blur(8px)' }}
        >
          {adding ? (
            <div className="w-full">
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() }
                  if (e.key === 'Escape') { setAdding(false); setDraft('') }
                }}
                placeholder="Название задачи..."
                rows={2}
                className="w-full text-sm bg-surface-2 border border-accent/30 rounded-lg px-2.5 py-1.5 resize-none outline-none text-fg-primary placeholder:text-fg-muted"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 px-2 py-0.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-md transition-colors"
                >
                  <Check size={11} />
                  Добавить
                </button>
                <button
                  onClick={() => { setAdding(false); setDraft('') }}
                  className="p-0.5 rounded text-fg-muted hover:text-fg-primary"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: column.textColor }}
            >
              <Plus size={13} />
              Добавить задачу
            </button>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        ref={dropRef}
        className="flex-1 flex flex-col gap-2 p-2 min-h-[80px] overflow-y-auto bg-surface-1"
      >
        <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} columnId={column.id} />
          ))}
        </SortableContext>

        {isEmpty && isFiltered && (
          <EmptyState icon={Search} title="Нет совпадений" hint="Попробуйте изменить фильтры или поисковый запрос" />
        )}
      </div>
    </div>
  )
}
