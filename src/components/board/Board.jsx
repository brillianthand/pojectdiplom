import { useState } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, closestCorners,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { Column } from './Column'
import { TaskCard } from './TaskCard'
import { BoardSkeleton } from './BoardSkeleton'
import { useStore } from '../../store/useStore'
import { usePermissions } from '../../lib/permissions'

const COL_PREFIX = 'col::'

const PRESETS = [
  { color: '#bbf7d0', textColor: '#14532d' },
  { color: '#bfdbfe', textColor: '#1e3a8a' },
  { color: '#e9d5ff', textColor: '#581c87' },
  { color: '#fed7aa', textColor: '#7c2d12' },
  { color: '#fecaca', textColor: '#7f1d1d' },
  { color: '#bae6fd', textColor: '#0c4a6e' },
  { color: '#fde68a', textColor: '#78350f' },
  { color: '#99f6e4', textColor: '#134e4a' },
  { color: '#fbcfe8', textColor: '#831843' },
]

export function Board() {
  const { getActiveBoard, moveTask, reorderColumns, addColumn, projects, activeProjectId, updateTask, currentUser } = useStore()
  const perms = usePermissions()
  const [activeTask, setActiveDragTask] = useState(null)
  const [activeColId, setActiveColId] = useState(null)

  const board = getActiveBoard()
  const activeBoardId = projects.find(p => p.id === activeProjectId)?.activeBoardId

  // Observers cannot drag — bumping the activation distance past the pointer
  // travel any user will produce effectively disables DnD without touching the
  // sensor wiring elsewhere on the page.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: perms.canEditTasks ? 6 : 999999 },
    })
  )

  if (activeBoardId && !board) return <BoardSkeleton />

  if (!board) return (
    <div className="flex-1 flex items-center justify-center text-white/60 text-sm">
      Нет доски
    </div>
  )

  const findColumnOfTask = (taskId) => {
    for (const col of board.columns) {
      if (board.tasks[col.id]?.some(t => t.id === taskId)) return col.id
    }
    return null
  }

  const isColumnDrag = (id) => typeof id === 'string' && id.startsWith(COL_PREFIX)

  const handleDragStart = ({ active }) => {
    if (isColumnDrag(active.id)) return
    const colId = findColumnOfTask(active.id)
    const task = board.tasks[colId]?.find(t => t.id === active.id)
    setActiveDragTask(task || null)
    setActiveColId(colId)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveDragTask(null)
    setActiveColId(null)
    if (!over) return

    // Column reorder
    if (isColumnDrag(active.id)) {
      if (!isColumnDrag(over.id)) return
      const fromIdx = board.columns.findIndex(c => COL_PREFIX + c.id === active.id)
      const toIdx = board.columns.findIndex(c => COL_PREFIX + c.id === over.id)
      if (fromIdx === toIdx || fromIdx === -1 || toIdx === -1) return
      const newOrder = [...board.columns.map(c => c.id)]
      const [moved] = newOrder.splice(fromIdx, 1)
      newOrder.splice(toIdx, 0, moved)
      reorderColumns(newOrder)
      return
    }

    // Task move
    const fromColId = findColumnOfTask(active.id)
    if (!fromColId) return

    const toColId = board.columns.some(c => c.id === over.id)
      ? over.id
      : findColumnOfTask(over.id)

    if (!toColId) return


    const fromTasks = board.tasks[fromColId]
    const toTasks = board.tasks[toColId]

    // ── WIP Limit (Максимум 3 задачи в работе) ────────────────
    if (fromColId !== toColId && currentUser?.id) {
      const toCol = board.columns.find(c => c.id === toColId)
      const isInProgress = toCol && (toCol.title.toLowerCase() === 'in progress' || toCol.title.toLowerCase() === 'в работе')

      if (isInProgress) {
        const draggedTask = fromTasks.find(t => t.id === active.id)
        // Считаем сколько задач В работе УЖЕ висят на этом пользователе
        const myTasksInProgress = toTasks.filter(t => t.assignees?.includes(currentUser.id)).length

        // Задача будет "моей", если я уже в исполнителях ИЛИ если сработает авто-назначение
        const willBeMine = draggedTask?.assignees?.includes(currentUser.id) ||
          (!draggedTask?.assignees || draggedTask.assignees.length === 0)

        if (willBeMine && myTasksInProgress >= 3) {
          alert('WIP Limit: вы не можете держать "В работе" больше 3 задач одновременно. Сначала завершите текущие!')
          return
        }
      }
    }

    if (fromColId === toColId) {
      const oldIdx = fromTasks.findIndex(t => t.id === active.id)
      const newIdx = fromTasks.findIndex(t => t.id === over.id)
      if (oldIdx !== newIdx && newIdx !== -1) moveTask(active.id, fromColId, toColId, newIdx)
    } else {
      const toIndex = toTasks.findIndex(t => t.id === over.id)
      moveTask(active.id, fromColId, toColId, toIndex === -1 ? toTasks.length : toIndex)

      // ── Авто-взятие в работу ────────────────────────────────
      const draggedTask = fromTasks.find(t => t.id === active.id)
      const toCol = board.columns.find(c => c.id === toColId)
      const isInProgress = toCol && (toCol.title.toLowerCase() === 'in progress' || toCol.title.toLowerCase() === 'в работе')

      if (isInProgress && draggedTask && (!draggedTask.assignees || draggedTask.assignees.length === 0)) {
        // Если перетащили в "В работе" и нет исполнителей — назначаем на себя
        if (currentUser?.id) {
          updateTask(draggedTask.id, { assignees: [currentUser.id] })
        }
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDragTask(null); setActiveColId(null) }}
    >
      <div className="flex gap-4 min-h-full overflow-x-auto px-5 py-5 scrollbar-thin items-start">
        <SortableContext
          items={board.columns.filter((c, i) => !(i === 0 && board.settings?.scrumEnabled)).map(c => COL_PREFIX + c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {board.columns.map((col, idx) => {
            if (idx === 0 && board.settings?.scrumEnabled) return null
            return (
              <Column
                key={col.id}
                column={col}
                tasks={board.tasks[col.id] || []}
              />
            )
          })}
        </SortableContext>

        {/* Right action panel — only manager+ may create columns. */}
        {perms.canManageBoards && (
          <div className="flex-shrink-0 ml-1">
            <button
              onClick={() => { const p = PRESETS[Math.floor(Math.random() * PRESETS.length)]; addColumn('Новая колонка', p.color, p.textColor) }}
              className="w-72 h-16 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/40 text-black/50 hover:text-black hover:border-black/70 hover:bg-black/5 transition-all duration-200 group"
            >
              <Plus size={16} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Добавить колонку</span>
            </button>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeTask && (
          <div className="rotate-1 scale-105 opacity-90">
            <TaskCard task={activeTask} columnId={activeColId} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
