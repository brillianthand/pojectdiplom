import { useStore } from '../store/useStore'
import { useShallow } from 'zustand/react/shallow'

export const ROLE_ADMIN    = 'admin'
export const ROLE_MANAGER  = 'manager'
export const ROLE_EXECUTOR = 'executor'
export const ROLE_OBSERVER = 'observer'

export const ALL_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_EXECUTOR, ROLE_OBSERVER]

export const ROLE_LABELS = {
  [ROLE_ADMIN]:    'Администратор',
  [ROLE_MANAGER]:  'Менеджер',
  [ROLE_EXECUTOR]: 'Исполнитель',
  [ROLE_OBSERVER]: 'Наблюдатель',
}

export const ROLE_HINTS = {
  [ROLE_ADMIN]:    'Полный доступ кроме удаления проекта',
  [ROLE_MANAGER]:  'Управляет досками, задачами и участниками',
  [ROLE_EXECUTOR]: 'Работает с задачами и комментариями',
  [ROLE_OBSERVER]: 'Только просмотр',
}

const RANK = {
  [ROLE_ADMIN]:    3,
  [ROLE_MANAGER]:  2,
  [ROLE_EXECUTOR]: 1,
  [ROLE_OBSERVER]: 0,
}

const rankOf = (r) => (r in RANK ? RANK[r] : -1)
const atLeast = (actual, required) => rankOf(actual) >= rankOf(required)

// Pure predicates mirrored from backend members/permissions.go — keep in sync.
export const can = {
  manageProject: (role) => role === ROLE_ADMIN,
  manageMembers: (role) => atLeast(role, ROLE_MANAGER),
  assignAdmin:   (role) => role === ROLE_ADMIN,
  manageBoards:  (role) => atLeast(role, ROLE_MANAGER),
  editTasks:     (role) => atLeast(role, ROLE_EXECUTOR),
  comment:       (role) => atLeast(role, ROLE_EXECUTOR),
  beAssignee:    (role) => atLeast(role, ROLE_EXECUTOR),
  view:          (role) => rankOf(role) >= 0,
}

const EMPTY = {
  role:             null,
  isOwner:          false,
  isMember:         false,
  isObserver:       false,
  canManageProject: false,
  canManageMembers: false,
  canAssignAdmin:   false,
  canManageBoards:  false,
  canEditTasks:     false,
  canComment:       false,
  canBeAssignee:    false,
}

// usePermissions returns the caller's role inside a project and per-action
// booleans. Without an argument it uses the active project. Non-members and
// pending invitees get EMPTY (everything disallowed).
export function usePermissions(projectId) {
  return useStore(useShallow(s => {
    const pid = projectId ?? s.activeProjectId
    if (!pid || !s.currentUser) return EMPTY
    const member = (s.members[pid] ?? []).find(m => m.id === s.currentUser.id)
    if (!member || member.status === 'pending') return EMPTY
    const role = member.role
    const wsProject = s.workspace?.projects.find(p => p.id === pid)
    return {
      role,
      isOwner:          wsProject?.ownerId === s.currentUser.id,
      isMember:         true,
      isObserver:       role === ROLE_OBSERVER,
      canManageProject: can.manageProject(role),
      canManageMembers: can.manageMembers(role),
      canAssignAdmin:   can.assignAdmin(role),
      canManageBoards:  can.manageBoards(role),
      canEditTasks:     can.editTasks(role),
      canComment:       can.comment(role),
      canBeAssignee:    can.beAssignee(role),
    }
  }))
}
