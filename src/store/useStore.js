import { create } from 'zustand'
import { api, setUnauthorizedHandler, setClientId } from '../api/index'
import { connectBoard, disconnect as wsDisconnect } from '../api/ws'
import { addRecent } from '../utils/recents'

function makeClientId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

let _notifPollInterval = null
function startNotifPolling(store) {
  if (_notifPollInterval) return
  _notifPollInterval = setInterval(async () => {
    if (!store.getState().currentUser) return
    const data = await api.getNotifCount().catch(() => null)
    if (data && data.count !== store.getState().unreadCount) {
      store.setState({ unreadCount: data.count })
    }
  }, 30_000)
}
function stopNotifPolling() {
  clearInterval(_notifPollInterval)
  _notifPollInterval = null
}

const getActiveBoardId = (state) =>
  state.projects.find(p => p.id === state.activeProjectId)?.activeBoardId

function mapBoardTasks(board, fn) {
  const newTasks = {}
  for (const [colId, tasks] of Object.entries(board.tasks)) {
    newTasks[colId] = fn(colId, tasks)
  }
  return { ...board, tasks: newTasks }
}

export const useStore = create((set, get) => ({
  theme: 'light',
  view: 'board',
  filters: { assignees: [], priorities: [], deadline: null },
  searchQuery: '',
  // ID колонок, в которых скрыты выполненные задачи (персонально, на сессию)
  hideCompletedColumns: new Set(),
  activeProjectId: null,
  activeTaskId: null,
  activeArchivedTask: null,
  initialized: false,
  apiError: null,
  currentUser: null,
  clientId: makeClientId(),

  projects: [],
  boards: {},
  members: {},
  notifications: [],
  unreadCount: 0,
  hasMoreNotifications: false,
  users: [],
  workspace: null,
  taskEvents: {},
  _workspaceFetching: null,

  adminUsers: [],
  adminStats: null,
  adminLoading: false,

  // Personal favorites — Set of task IDs, hydrated once on app load.
  starredIds: new Set(),

  // Cross-project activity feed shown on WorkspaceView.
  feed: [],
  feedLoading: false,

  // Personal tasks — private per-user checklist, not tied to any project/board.
  personalTasks: [],
  personalTasksLoading: false,

  // ── error handling ────────────────────────────────────────
  setApiError: (msg) => set({ apiError: msg }),
  dismissError: () => set({ apiError: null }),

  // ── auth ──────────────────────────────────────────────────
  login: async (email, password) => {
    const data = await api.login({ email, password })
    localStorage.setItem('kanban_token', data.token)
    set({ currentUser: data.user })
    await get()._loadApp()
  },

  register: async (email, password, name) => {
    const data = await api.register({ email, password, name })
    localStorage.setItem('kanban_token', data.token)
    set({ currentUser: data.user })
    await get()._loadApp()
  },

  updateProfile: async ({ name, avatarUrl }) => {
    const u = await api.updateProfile({ name, avatarUrl })
    set(s => ({
      currentUser: u,
      users: s.users.map(x => x.id === u.id ? { ...x, ...u } : x),
    }))
    return u
  },

  changePassword: async ({ oldPassword, newPassword }) => {
    await api.changePassword({ oldPassword, newPassword })
  },

  logout: () => {
    wsDisconnect()
    stopNotifPolling()
    localStorage.removeItem('kanban_token')
    set({ currentUser: null, view: 'login', projects: [], boards: {}, members: {}, notifications: [], unreadCount: 0, hasMoreNotifications: false, activeProjectId: null, workspace: null, starredIds: new Set(), feed: [], personalTasks: [] })
  },

  // ── init ──────────────────────────────────────────────────
  initialize: async () => {
    setClientId(get().clientId)
    try {
      const u = await api.me()
      set({ currentUser: u })
    } catch {
      set({ initialized: true, view: 'login' })
      return
    }
    await get()._loadApp()
  },

  _loadApp: async () => {
    const projects = await api.getProjects().catch(() => [])

    const firstProject = projects[0] ?? null
    const savedView = localStorage.getItem('kanban_view')
    const savedProjectId = localStorage.getItem('kanban_project')
    const RESTORABLE = ['workspace', 'board', 'calendar', 'list', 'my-tasks', 'notifications', 'reports', 'members', 'settings', 'admin', 'backlog']
    const activeProject = projects.find(p => p.id === savedProjectId) ?? firstProject
    const view = RESTORABLE.includes(savedView) ? savedView : 'workspace'

    if (activeProject) localStorage.setItem('kanban_project', activeProject.id)
    localStorage.setItem('kanban_view', view)

    const projectsWithLocalBoard = projects.map(p => {
      const localBoard = localStorage.getItem(`kanban_active_board_${p.id}`)
      const validLocal = localBoard && p.boards.some(b => b.id === localBoard)
      return validLocal ? { ...p, activeBoardId: localBoard } : p
    })

    set({ projects: projectsWithLocalBoard, activeProjectId: activeProject?.id ?? null, initialized: true, view })

    get().loadWorkspace()
    get().loadNotifications()
    get().loadStars()
    startNotifPolling(useStore)

    if (activeProject) {
      const resolvedProject = projectsWithLocalBoard.find(p => p.id === activeProject.id)
      const boardId = resolvedProject?.activeBoardId
      if (boardId && view !== 'workspace') await get().loadBoard(boardId)
      await get().loadMembers(activeProject.id)
    }

    // Открыть задачу из URL-хэша (#task=<id>)
    const hash = window.location.hash
    if (hash.startsWith('#task=')) {
      const taskId = hash.slice(6)
      if (taskId) set({ activeTaskId: taskId })
    }
  },

  loadWorkspace: () => {
    const existing = get()._workspaceFetching
    if (existing) return existing
    const promise = api.getWorkspace()
      .then(ws => { if (ws) set({ workspace: ws }) })
      .catch(err => set({ apiError: err.message }))
      .finally(() => set({ _workspaceFetching: null }))
    set({ _workspaceFetching: promise })
    return promise
  },

  loadBoard: async (boardId) => {
    const board = await api.getBoard(boardId).catch((err) => {
      if (err.status === 404) {
        set(s => ({
          projects: s.projects.map(p =>
            p.activeBoardId === boardId
              ? { ...p, boards: p.boards.filter(b => b.id !== boardId), activeBoardId: p.boards.find(b => b.id !== boardId)?.id ?? '' }
              : p
          ),
          view: 'workspace',
        }))
      } else {
        set({ apiError: err.message })
      }
      return null
    })
    if (!board) return
    set(s => ({ boards: { ...s.boards, [boardId]: board } }))
    const { clientId } = get()
    connectBoard(boardId, clientId, (event) => get().applyRemoteEvent(event))
  },

  applyRemoteEvent: (event) => {
    if (event.clientId === get().clientId) return
    get().loadBoard(event.boardId)
    if (get().view === 'backlog') {
      get().loadSprints(event.boardId)
    }
    if (event.type === 'taskUpdated') {
      api.getNotifCount()
        .then(data => { if (data.count !== get().unreadCount) set({ unreadCount: data.count }) })
        .catch(() => { })
    }
    const activeId = get().activeTaskId
    if (activeId) get().loadTaskEvents(activeId)
  },

  loadTaskEvents: async (taskId) => {
    if (!taskId) return
    try {
      const list = await api.getTaskEvents(taskId)
      set(s => ({ taskEvents: { ...s.taskEvents, [taskId]: Array.isArray(list) ? list : [] } }))
    } catch (err) {
      console.error('loadTaskEvents failed:', err)
      set(s => ({
        taskEvents: { ...s.taskEvents, [taskId]: [] },
        apiError: `Активность: ${err.message}`,
      }))
    }
  },

  // ── activity feed ─────────────────────────────────────────
  loadFeed: async (limit = 20) => {
    set({ feedLoading: true })
    try {
      const items = await api.getFeed(limit)
      set({ feed: Array.isArray(items) ? items : [] })
    } catch (err) {
      set({ apiError: err.message })
    } finally {
      set({ feedLoading: false })
    }
  },

  // ── favorites (stars) ─────────────────────────────────────
  loadStars: async () => {
    const ids = await api.getStars().catch(() => null)
    if (Array.isArray(ids)) set({ starredIds: new Set(ids) })
  },

  // Optimistic toggle: flip the Set immediately, fire the API,
  // and revert on failure so the UI never drifts from the server.
  toggleStar: async (taskId) => {
    if (!taskId) return
    const prev = get().starredIds
    const was = prev.has(taskId)
    const next = new Set(prev)
    if (was) next.delete(taskId)
    else next.add(taskId)
    set({ starredIds: next })
    try {
      if (was) await api.unstarTask(taskId)
      else await api.starTask(taskId)
    } catch (err) {
      set({ starredIds: prev, apiError: err.message })
    }
  },

  // ── personal tasks ────────────────────────────────────────
  loadPersonalTasks: async () => {
    set({ personalTasksLoading: true })
    try {
      const items = await api.getPersonalTasks()
      set({ personalTasks: Array.isArray(items) ? items : [] })
    } catch (err) {
      set({ apiError: err.message })
    } finally {
      set({ personalTasksLoading: false })
    }
  },

  addPersonalTask: async ({ title, dueDate = null, notes = '' }) => {
    const t = (title ?? '').trim()
    if (!t) return
    try {
      const created = await api.createPersonalTask({ title: t, dueDate, notes })
      set(s => ({ personalTasks: [...s.personalTasks, created] }))
    } catch (err) {
      set({ apiError: err.message })
    }
  },

  updatePersonalTask: async (id, changes) => {
    const prev = get().personalTasks
    set({ personalTasks: prev.map(t => t.id === id ? { ...t, ...changes } : t) })
    try {
      const updated = await api.updatePersonalTask(id, changes)
      set(s => ({ personalTasks: s.personalTasks.map(t => t.id === id ? updated : t) }))
    } catch (err) {
      set({ personalTasks: prev, apiError: err.message })
    }
  },

  togglePersonalTask: (id) => {
    const t = get().personalTasks.find(x => x.id === id)
    if (!t) return
    return get().updatePersonalTask(id, { completed: !t.completed })
  },

  deletePersonalTask: async (id) => {
    const prev = get().personalTasks
    set({ personalTasks: prev.filter(t => t.id !== id) })
    try {
      await api.deletePersonalTask(id)
    } catch (err) {
      set({ personalTasks: prev, apiError: err.message })
    }
  },

  // ── company users ─────────────────────────────────────────
  loadUsers: async () => {
    const list = await api.getUsers().catch(() => [])
    set({ users: list })
  },

  // ── members ───────────────────────────────────────────────
  loadMembers: async (projectId) => {
    const list = await api.getMembers(projectId).catch(err => {
      set({ apiError: err.message })
      return null
    })
    if (list) set(s => ({ members: { ...s.members, [projectId]: list } }))
  },

  inviteMember: async (email, role) => {
    const projectId = get().activeProjectId
    if (!projectId) return null
    const member = await api.inviteMember(projectId, email, role).catch(err => {
      set({ apiError: err.message })
      return null
    })
    if (!member) return null
    set(s => ({
      members: {
        ...s.members,
        [projectId]: [...(s.members[projectId] ?? []), member],
      },
    }))
    return member
  },

  updateMemberRole: async (userId, role) => {
    const projectId = get().activeProjectId
    if (!projectId) return
    set(s => ({
      members: {
        ...s.members,
        [projectId]: (s.members[projectId] ?? []).map(m =>
          m.id === userId ? { ...m, role } : m
        ),
      },
    }))
    await api.updateMemberRole(projectId, userId, role).catch(err => {
      set({ apiError: err.message })
    })
  },

  acceptInvite: async (projectId) => {
    await api.acceptInvite(projectId).catch(err => {
      set({ apiError: err.message })
      return null
    })
    set(s => ({
      notifications: s.notifications.map(n =>
        n.projectId === projectId && n.type === 'invite' ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - s.notifications.filter(
        n => n.projectId === projectId && n.type === 'invite' && !n.read
      ).length),
    }))
    const projects = await api.getProjects().catch(() => null)
    if (projects) set({ projects })
    get().loadWorkspace()
  },

  declineInvite: async (projectId) => {
    await api.declineInvite(projectId).catch(err => {
      set({ apiError: err.message })
    })
    set(s => ({
      notifications: s.notifications.map(n =>
        n.projectId === projectId && n.type === 'invite' ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - s.notifications.filter(
        n => n.projectId === projectId && n.type === 'invite' && !n.read
      ).length),
    }))
  },

  // ── notifications ─────────────────────────────────────────
  loadNotifications: async () => {
    const data = await api.getNotifications().catch(() => null)
    if (!data) return
    const unreadCount = data.items.filter(n => !n.read).length
    set({ notifications: data.items, unreadCount, hasMoreNotifications: data.hasMore })
  },

  loadMoreNotifications: async () => {
    const { notifications } = get()
    if (!notifications.length) return
    const cursor = notifications[notifications.length - 1].createdAt
    const data = await api.getNotifications(cursor).catch(() => null)
    if (!data) return
    const merged = [...notifications, ...data.items]
    const unreadCount = merged.filter(n => !n.read).length
    set({ notifications: merged, unreadCount, hasMoreNotifications: data.hasMore })
  },

  markNotificationRead: async (id) => {
    const target = get().notifications.find(n => n.id === id)
    if (!target || target.read) return
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
    await api.markNotificationRead(id).catch(() => { })
  },

  // Open the entity that a notification points to. Marks it read first,
  // then resolves the project from the board reference and navigates.
  openNotification: async (n) => {
    if (!n) return
    if (!n.read) get().markNotificationRead(n.id)

    // Role-change notifications carry only a projectId — land the user on
    // that project's members view so they can see the new role context.
    if (n.type === 'role_changed' && n.projectId) {
      const project = get().projects.find(p => p.id === n.projectId)
      if (!project) return
      if (project.id !== get().activeProjectId) {
        get().setActiveProject(project.id)
      }
      set({ view: 'members' })
      localStorage.setItem('kanban_view', 'members')
      return
    }

    if (!n.boardId || !n.taskId) return

    const project = get().projects.find(p => p.boards.some(b => b.id === n.boardId))
    if (!project) return

    if (project.id !== get().activeProjectId) {
      get().setActiveProject(project.id)
    }
    if (project.activeBoardId !== n.boardId) {
      await get().setActiveBoard(n.boardId)
    }
    set({ view: 'board', activeTaskId: n.taskId })
  },

  markNotificationsRead: async () => {
    await api.markNotificationsRead().catch(() => { })
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  // ── board data preload (no WS reconnect) ──────────────────
  fetchBoardData: async (boardId) => {
    if (get().boards[boardId]) return
    const board = await api.getBoard(boardId).catch(() => null)
    if (board) set(s => ({ boards: { ...s.boards, [boardId]: board } }))
  },

  loadAllProjectBoards: async () => {
    const state = get()
    const project = state.projects.find(p => p.id === state.activeProjectId)
    if (!project) return
    await Promise.all(project.boards.map(b => get().fetchBoardData(b.id)))
  },

  loadAllBoardsAcrossProjects: async () => {
    const { projects, fetchBoardData } = get()
    const ids = projects.flatMap(p => p.boards.map(b => b.id))
    await Promise.all(ids.map(id => fetchBoardData(id)))
  },

  transferOwnership: async (userId) => {
    const projectId = get().activeProjectId
    if (!projectId || !userId) return false
    try {
      await api.transferOwnership(projectId, userId)
    } catch (err) {
      set({ apiError: err.message })
      return false
    }
    set(s => ({
      projects: s.projects.map(p => p.id === projectId ? { ...p, ownerId: userId } : p),
      members: {
        ...s.members,
        [projectId]: (s.members[projectId] ?? []).map(m =>
          m.id === userId ? { ...m, role: 'admin' } : m
        ),
      },
    }))
    return true
  },

  removeMember: async (userId) => {
    const projectId = get().activeProjectId
    if (!projectId) return
    await api.removeMember(projectId, userId).catch(err => {
      set({ apiError: err.message })
    })
    set(s => ({
      members: {
        ...s.members,
        [projectId]: (s.members[projectId] ?? []).filter(m => m.id !== userId),
      },
    }))
  },

  // ── theme / view / filters ────────────────────────────────
  setTheme: (theme) => {
    set({ theme })
    document.documentElement.classList.toggle('dark', theme === 'dark')
  },

  setView: (view) => {
    set({ view })
    localStorage.setItem('kanban_view', view)
  },

  setFilters: (filters) => set(s => ({ filters: { ...s.filters, ...filters } })),

  clearFilters: () =>
    set({ filters: { assignees: [], priorities: [], deadline: null } }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleColumnHideCompleted: (columnId) => set(s => {
    const next = new Set(s.hideCompletedColumns)
    if (next.has(columnId)) next.delete(columnId)
    else next.add(columnId)
    return { hideCompletedColumns: next }
  }),

  // ── projects ──────────────────────────────────────────────
  setActiveProject: (id) => {
    localStorage.setItem('kanban_project', id)
    localStorage.setItem('kanban_view', 'board')
    set({ activeProjectId: id, activeTaskId: null, view: 'board' })
    const project = get().projects.find(p => p.id === id)
    const boardId = project?.activeBoardId
    if (boardId && !get().boards[boardId]) get().loadBoard(boardId)
    if (!get().members[id]) get().loadMembers(id)
  },

  setActiveBoard: async (boardId) => {
    const state = get()
    const project = state.projects.find(p => p.id === state.activeProjectId)
    const board = project?.boards.find(b => b.id === boardId)
    if (board && project) {
      addRecent({ type: 'board', id: boardId, title: board.name, subtitle: project.name, projectId: project.id })
    }
    set({
      projects: state.projects.map(p =>
        p.id === state.activeProjectId ? { ...p, activeBoardId: boardId } : p
      ),
      activeTaskId: null,
    })
    localStorage.setItem(`kanban_active_board_${state.activeProjectId}`, boardId)
    if (!get().boards[boardId]) {
      await get().loadBoard(boardId)
    } else {
      // Board already cached — just reconnect WS to the new board
      const { clientId } = get()
      connectBoard(boardId, clientId, (event) => get().applyRemoteEvent(event))
    }
  },

  deleteBoard: async (boardId) => {
    const ok = await api.deleteBoard(boardId).then(() => true).catch(err => { set({ apiError: err.message }); return false })
    if (!ok) return
    const projectId = get().activeProjectId
    const remainingBoards = get().projects.find(p => p.id === projectId)?.boards.filter(b => b.id !== boardId) ?? []
    const newView = remainingBoards.length > 0 ? 'board' : 'no-projects'
    set(s => {
      const newBoards = { ...s.boards }
      delete newBoards[boardId]
      return {
        projects: s.projects.map(p =>
          p.id === projectId ? { ...p, boards: remainingBoards, activeBoardId: remainingBoards[0]?.id ?? '' } : p
        ),
        boards: newBoards,
        view: newView,
      }
    })
    localStorage.setItem('kanban_view', newView)
    const newBoardId = get().projects.find(p => p.id === projectId)?.activeBoardId
    if (newBoardId) get().loadBoard(newBoardId)
  },

  addBoard: async (name) => {
    const state = get()

    // Определяем шаблон по текущей активной доске
    const activeBoard = state.projects.find(p => p.id === state.activeProjectId)?.activeBoardId
      ? state.boards[state.projects.find(p => p.id === state.activeProjectId).activeBoardId]
      : null
    const template = activeBoard?.settings?.scrumEnabled ? 'scrum' : 'empty'

    const board = await api.createBoard(state.activeProjectId, { name, template })
      .catch(err => { set({ apiError: err.message }); return null })
    if (!board) return
    set(s => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, boards: [...p.boards, { id: board.id, name }], activeBoardId: board.id }
          : p
      ),
    }))
    await get().loadBoard(board.id)
  },

  createProject: async ({ name, template = 'kanban', memberIds = [], inviteEmails = [], customColumns = [] } = {}) => {
    const project = await api.createProject({ name, template, memberIds, inviteEmails, customColumns })
      .catch(err => { set({ apiError: err.message }); return null })
    if (!project) return null
    localStorage.setItem('kanban_project', project.id)
    localStorage.setItem('kanban_view', 'board')
    set(s => ({ projects: [...s.projects, project], activeProjectId: project.id, view: 'board' }))
    if (project.activeBoardId) await get().loadBoard(project.activeBoardId)
    await get().loadMembers(project.id)
    get().loadWorkspace()
    return project
  },

  updateProject: async (projectId, updates) => {
    set(s => ({
      projects: s.projects.map(p => p.id === projectId ? { ...p, ...updates } : p),
      workspace: s.workspace ? {
        ...s.workspace,
        projects: s.workspace.projects.map(p => p.id === projectId ? { ...p, ...updates } : p),
      } : s.workspace,
    }))
    api.updateProject(projectId, updates).catch(err => set({ apiError: err.message }))
  },

  deleteProject: async (projectId) => {
    await api.deleteProject(projectId).catch(err => { set({ apiError: err.message }) })
    set(s => {
      const projects = s.projects.filter(p => p.id !== projectId)
      const next = projects[0] ?? null
      if (next) localStorage.setItem('kanban_project', next.id)
      else localStorage.removeItem('kanban_project')
      const stayOnWorkspace = s.view === 'workspace'
      const nextView = stayOnWorkspace ? 'workspace' : (next ? 'board' : 'no-projects')
      localStorage.setItem('kanban_view', nextView)
      return {
        projects,
        activeProjectId: next?.id ?? null,
        view: nextView,
      }
    })
    const nextId = get().projects[0]?.activeBoardId
    if (nextId && get().view !== 'workspace') get().loadBoard(nextId)
    get().loadWorkspace()
  },

  renameBoard: async (boardId, name) => {
    set(s => ({
      projects: s.projects.map(p => ({
        ...p,
        boards: p.boards.map(b => b.id === boardId ? { ...b, name } : b),
      })),
    }))
    api.updateBoard(boardId, { name }).catch(err => set({ apiError: err.message }))
  },

  // ── navigation ───────────────────────────────────────────
  navigateToTask: async (taskId, boardId, projectId) => {
    const state = get()
    if (state.activeProjectId !== projectId) {
      localStorage.setItem('kanban_project', projectId)
      set({ activeProjectId: projectId })
      await get().loadMembers(projectId)
    }
    set(s => ({
      projects: s.projects.map(p =>
        p.id === projectId ? { ...p, activeBoardId: boardId } : p
      ),
      view: 'board',
    }))
    localStorage.setItem('kanban_view', 'board')
    if (!get().boards[boardId]) await get().loadBoard(boardId)
    get().setActiveTask(taskId)
  },

  // ── tasks ─────────────────────────────────────────────────
  setActiveTask: (id) => {
    set({ activeTaskId: id, activeArchivedTask: null })
    if (id) window.location.hash = `task=${id}`
    else if (window.location.hash.startsWith('#task=')) history.replaceState(null, '', location.pathname + location.search)
  },
  openArchivedTask: async (taskId) => {
    try {
      const full = await api.getTask(taskId)
      set({ activeTaskId: taskId, activeArchivedTask: full })
      window.location.hash = `task=${taskId}`
    } catch (err) {
      set({ apiError: err.message })
    }
  },
  closeTask: () => {
    set({ activeTaskId: null, activeArchivedTask: null })
    if (window.location.hash.startsWith('#task=')) history.replaceState(null, '', location.pathname + location.search)
  },

  getActiveBoard: () => {
    const state = get()
    const boardId = getActiveBoardId(state)
    return boardId ? state.boards[boardId] : null
  },

  getActiveTask: () => {
    const state = get()
    if (!state.activeTaskId) return null
    if (state.activeArchivedTask?.id === state.activeTaskId) return state.activeArchivedTask
    const boardId = getActiveBoardId(state)
    if (!boardId) return null
    const board = state.boards[boardId]
    if (!board) return null
    for (const col of board.columns) {
      const t = board.tasks[col.id]?.find(t => t.id === state.activeTaskId)
      if (t) return t
    }
    return null
  },

  addTask: async (columnId, title) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    const task = await api.createTask(columnId, title)
      .catch(err => { set({ apiError: err.message }); return null })
    if (!task) return
    set(s => {
      const board = s.boards[boardId]
      const currentSprintData = s.sprintData[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            tasks: {
              ...board.tasks,
              [columnId]: [task, ...(board.tasks[columnId] || [])],
            },
          },
        },
        sprintData: currentSprintData ? {
          ...s.sprintData,
          [boardId]: {
            ...currentSprintData,
            // If task is created without a sprint, it belongs in the backlog view.
            backlogTasks: [task, ...(currentSprintData.backlogTasks || [])]
          }
        } : s.sprintData
      }
    })
  },

  addTaskWithDate: async (columnId, dueDate, title, assignees = []) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return null
    const task = await api.createTask(columnId, title)
      .catch(err => { set({ apiError: err.message }); return null })
    if (!task) return null
    const updates = { dueDate }
    if (assignees.length) updates.assignees = assignees
    await api.updateTask(task.id, updates)
      .catch(err => set({ apiError: err.message }))
    const enriched = { ...task, dueDate, assignees }
    set(s => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            tasks: {
              ...board.tasks,
              [columnId]: [enriched, ...(board.tasks[columnId] || [])],
            },
          },
        },
      }
    })
    return enriched
  },

  archiveTask: async (taskId) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    await api.archiveTask(taskId).catch(err => { set({ apiError: err.message }) })
    if (get().activeTaskId === taskId) set({ activeTaskId: null })
    set(s => {
      const board = s.boards[boardId]
      if (!board) return {}
      const newTasks = {}
      for (const [colId, tasks] of Object.entries(board.tasks)) {
        newTasks[colId] = tasks.filter(t => t.id !== taskId)
      }
      return { boards: { ...s.boards, [boardId]: { ...board, tasks: newTasks } } }
    })
  },

  restoreTask: async (taskId) => {
    await api.restoreTask(taskId).catch(err => { set({ apiError: err.message }) })
    if (get().activeArchivedTask?.id === taskId) set({ activeArchivedTask: null })
    const boardId = getActiveBoardId(get())
    if (boardId) get().loadBoard(boardId)
  },

  duplicateTask: async (taskId) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    const task = await api.duplicateTask(taskId)
      .catch(err => { set({ apiError: err.message }); return null })
    if (!task) return
    set(s => {
      const board = s.boards[boardId]
      const col = task.columnId
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            tasks: {
              ...board.tasks,
              [col]: [...(board.tasks[col] || []), task],
            },
          },
        },
      }
    })
  },

  updateTask: async (taskId, updates) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      const currentSprintData = s.sprintData[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: mapBoardTasks(board, (_colId, tasks) =>
            tasks.map(t => (t.id === taskId ? { ...t, ...updates } : t))
          ),
        },
        sprintData: currentSprintData ? {
          ...s.sprintData,
          [boardId]: {
            ...currentSprintData,
            backlogTasks: (currentSprintData.backlogTasks || []).map(t =>
              t.id === taskId ? { ...t, ...updates } : t
            )
          }
        } : s.sprintData
      }
    })
    api.updateTask(taskId, updates)
      .then(() => { if (get().activeTaskId === taskId) get().loadTaskEvents(taskId) })
      .catch(err => set({ apiError: err.message }))
  },

  toggleTaskComplete: (taskId, boardId) => {
    const state = get()
    boardId = boardId || getActiveBoardId(state)
    if (!boardId) return
    const board = state.boards[boardId]
    for (const col of board.columns) {
      const t = board.tasks[col.id]?.find(t => t.id === taskId)
      if (!t) continue
      const completing = !t.completed
      get().updateTask(taskId, { completed: completing })

      // Auto-move on complete is governed by board.settings:
      //  - autoMoveOnComplete OFF → never move
      //  - autoMoveColumnId set & exists → move there
      //  - empty/missing → last column (legacy default)
      const settings = board.settings || {}
      if (completing && settings.autoMoveOnComplete && board.columns.length > 0) {
        let targetCol = board.columns.find(c => c.id === settings.autoMoveColumnId)
        if (!targetCol) targetCol = board.columns[board.columns.length - 1]
        if (targetCol && col.id !== targetCol.id) {
          const toIndex = (board.tasks[targetCol.id] || []).length
          get().moveTask(taskId, col.id, targetCol.id, toIndex)
        }
      }
      break
    }
  },

  updateBoardSettings: async (changes) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    const board = state.boards[boardId]
    const prev = board?.settings || {}
    const next = { ...prev, ...changes }
    set(s => ({
      boards: { ...s.boards, [boardId]: { ...s.boards[boardId], settings: next } },
    }))
    try {
      await api.updateBoardSettings(boardId, next)
    } catch (err) {
      set(s => ({
        boards: { ...s.boards, [boardId]: { ...s.boards[boardId], settings: prev } },
        apiError: err.message,
      }))
    }
  },

  addComment: async (taskId, text, attachments = []) => {
    const comment = await api.addComment(taskId, text, attachments)
      .catch(err => { set({ apiError: err.message }); return null })
    if (!comment) return
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: mapBoardTasks(board, (_colId, tasks) =>
            tasks.map(t =>
              t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t
            )
          ),
        },
      }
    })
  },

  moveTask: (taskId, fromColId, toColId, toIndex) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      const fromTasks = [...(board.tasks[fromColId] || [])]
      const taskIdx = fromTasks.findIndex(t => t.id === taskId)
      if (taskIdx === -1) return s
      const [task] = fromTasks.splice(taskIdx, 1)
      const toTasks = fromColId === toColId ? fromTasks : [...(board.tasks[toColId] || [])]
      toTasks.splice(toIndex, 0, task)

      const newBoard = {
        ...board,
        tasks: {
          ...board.tasks,
          [fromColId]: fromColId === toColId ? toTasks : fromTasks,
          [toColId]: toTasks,
        },
      }

      api.moveTask(taskId, {
        fromColumnId: fromColId,
        toColumnId: toColId,
        fromIds: (fromColId === toColId ? toTasks : fromTasks).map(t => t.id),
        toIds: toTasks.map(t => t.id),
      })
        .then(() => { if (get().activeTaskId === taskId) get().loadTaskEvents(taskId) })
        .catch(err => set({ apiError: err.message }))

      return { boards: { ...s.boards, [boardId]: newBoard } }
    })
  },

  addColumn: async (title, color = '#f8fafc', textColor = '#475569') => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    const col = await api.createColumn(boardId, { title, color, textColor })
      .catch(err => { set({ apiError: err.message }); return null })
    if (!col) return
    set(s => {
      const board = s.boards[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            columns: [...board.columns, col],
            tasks: { ...board.tasks, [col.id]: [] },
          },
        },
      }
    })
  },

  updateColumn: async (columnId, updates) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            columns: board.columns.map(c => (c.id === columnId ? { ...c, ...updates } : c)),
          },
        },
      }
    })
    api.updateColumn(columnId, updates)
      .catch(err => set({ apiError: err.message }))
  },

  deleteColumn: async (columnId) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      const newTasks = { ...board.tasks }
      delete newTasks[columnId]
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            columns: board.columns.filter(c => c.id !== columnId),
            tasks: newTasks,
          },
        },
      }
    })
    api.deleteColumn(columnId)
      .catch(err => set({ apiError: err.message }))
  },

  reorderColumns: async (orderedIds) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      const colMap = Object.fromEntries(board.columns.map(c => [c.id, c]))
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            columns: orderedIds.map(id => colMap[id]).filter(Boolean),
          },
        },
      }
    })
    api.reorderColumns(boardId, orderedIds)
      .catch(err => set({ apiError: err.message }))
  },

  deleteTask: async (taskId) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: mapBoardTasks(board, (_colId, tasks) =>
            tasks.filter(t => t.id !== taskId)
          ),
        },
        activeTaskId: null,
      }
    })
    api.deleteTask(taskId)
      .catch(err => set({ apiError: err.message }))
  },

  deleteComment: async (taskId, commentId) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: mapBoardTasks(board, (_colId, tasks) =>
            tasks.map(t =>
              t.id === taskId ? { ...t, comments: t.comments.filter(c => c.id !== commentId) } : t
            )
          ),
        },
      }
    })
    api.deleteComment(commentId)
      .catch(err => set({ apiError: err.message }))
  },

  updateComment: async (taskId, commentId, text) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => {
      const board = s.boards[boardId]
      return {
        boards: {
          ...s.boards,
          [boardId]: mapBoardTasks(board, (_colId, tasks) =>
            tasks.map(t =>
              t.id === taskId
                ? { ...t, comments: t.comments.map(c => c.id === commentId ? { ...c, text } : c) }
                : t
            )
          ),
        },
      }
    })
    api.updateComment(taskId, commentId, text)
      .catch(err => set({ apiError: err.message }))
  },

  addSubtask: async (taskId, title) => {
    const subtask = await api.createSubtask(taskId, title)
      .catch(err => { set({ apiError: err.message }); return null })
    if (!subtask) return
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => ({
      boards: {
        ...s.boards,
        [boardId]: mapBoardTasks(s.boards[boardId], (_colId, tasks) =>
          tasks.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), subtask] } : t)
        ),
      },
    }))
  },

  updateSubtask: async (taskId, subtaskId, changes) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => ({
      boards: {
        ...s.boards,
        [boardId]: mapBoardTasks(s.boards[boardId], (_colId, tasks) =>
          tasks.map(t =>
            t.id === taskId
              ? { ...t, subtasks: (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, ...changes } : s) }
              : t
          )
        ),
      },
    }))
    api.updateSubtask(subtaskId, changes)
      .catch(err => set({ apiError: err.message }))
  },

  deleteSubtask: async (taskId, subtaskId) => {
    const state = get()
    const boardId = getActiveBoardId(state)
    if (!boardId) return
    set(s => ({
      boards: {
        ...s.boards,
        [boardId]: mapBoardTasks(s.boards[boardId], (_colId, tasks) =>
          tasks.map(t =>
            t.id === taskId
              ? { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId) }
              : t
          )
        ),
      },
    }))
    api.deleteSubtask(subtaskId)
      .catch(err => set({ apiError: err.message }))
  },

  // ── admin ─────────────────────────────────────────────────
  loadAdmin: async () => {
    set({ adminLoading: true })
    const [users, stats] = await Promise.all([
      api.adminListUsers().catch(err => { set({ apiError: err.message }); return [] }),
      api.adminStats().catch(() => null),
    ])
    set({ adminUsers: users || [], adminStats: stats, adminLoading: false })
  },

  adminUpdateUser: async (id, updates) => {
    const prev = get().adminUsers
    set({ adminUsers: prev.map(u => u.id === id ? { ...u, ...updates } : u) })
    try {
      await api.adminPatchUser(id, updates)
      get().loadAdmin()
    } catch (err) {
      set({ apiError: err.message, adminUsers: prev })
    }
  },

  adminDeleteUser: async (id) => {
    const prev = get().adminUsers
    set({ adminUsers: prev.filter(u => u.id !== id) })
    try {
      await api.adminDeleteUser(id)
      get().loadAdmin()
    } catch (err) {
      set({ apiError: err.message, adminUsers: prev })
    }
  },

  // ── filtering ─────────────────────────────────────────────
  getFilteredTasks: (tasks) => {
    const { filters, searchQuery } = get()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()))

    return tasks.filter(task => {
      if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false
      if (filters.assignees.length && !filters.assignees.some(a => task.assignees.includes(a))) return false

      if (filters.deadline) {
        const due = task.dueDate ? new Date(task.dueDate) : null
        if (!due) return false
        if (filters.deadline === 'overdue' && due >= today) return false
        if (filters.deadline === 'today') {
          const d = new Date(due); d.setHours(0, 0, 0, 0)
          if (d.getTime() !== today.getTime()) return false
        }
        if (filters.deadline === 'week' && due > endOfWeek) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!task.title.toLowerCase().includes(q) &&
          !task.description.toLowerCase().includes(q)) return false
      }

      return true
    })
  },

  // ── sprints ───────────────────────────────────────────────
  // { [boardId]: { sprints: Sprint[], backlogTasks: BacklogTask[] } }
  sprintData: {},
  sprintLoading: false,

  loadSprints: async (boardId) => {
    if (!boardId) return
    set({ sprintLoading: true })
    try {
      const data = await api.getSprints(boardId)
      set(s => ({ sprintData: { ...s.sprintData, [boardId]: data } }))
    } catch (err) {
      set({ apiError: err.message })
    } finally {
      set({ sprintLoading: false })
    }
  },

  createSprint: async (boardId, data) => {
    try {
      const sprint = await api.createSprint(boardId, data)
      set(s => {
        const bd = s.sprintData[boardId] || { sprints: [], backlogTasks: [] }
        return { sprintData: { ...s.sprintData, [boardId]: { ...bd, sprints: [sprint, ...bd.sprints] } } }
      })
      return sprint
    } catch (err) {
      set({ apiError: err.message })
      return null
    }
  },

  updateSprint: async (sprintId, data) => {
    const boardId = get()._sprintBoardId(sprintId)
    try {
      const updated = await api.updateSprint(sprintId, data)
      set(s => {
        const bd = s.sprintData[boardId] || { sprints: [], backlogTasks: [] }
        return { sprintData: { ...s.sprintData, [boardId]: { ...bd, sprints: bd.sprints.map(sp => sp.id === sprintId ? updated : sp) } } }
      })
    } catch (err) {
      set({ apiError: err.message })
    }
  },

  startSprint: async (sprintId) => {
    const boardId = get()._sprintBoardId(sprintId)
    try {
      const started = await api.startSprint(sprintId)
      set(s => {
        const bd = s.sprintData[boardId] || { sprints: [], backlogTasks: [] }
        return { sprintData: { ...s.sprintData, [boardId]: { ...bd, sprints: bd.sprints.map(sp => sp.id === sprintId ? started : sp) } } }
      })
      await get().loadBoard(boardId)
    } catch (err) {
      set({ apiError: err.message })
    }
  },

  completeSprint: async (sprintId) => {
    const boardId = get()._sprintBoardId(sprintId)
    try {
      const result = await api.completeSprint(sprintId)
      // Reload sprint data to get updated backlog
      await get().loadSprints(boardId)
      await get().loadBoard(boardId)
      return result
    } catch (err) {
      set({ apiError: err.message })
      return null
    }
  },

  deleteSprint: async (sprintId) => {
    const boardId = get()._sprintBoardId(sprintId)
    try {
      await api.deleteSprint(sprintId)
      set(s => {
        const bd = s.sprintData[boardId] || { sprints: [], backlogTasks: [] }
        return { sprintData: { ...s.sprintData, [boardId]: { ...bd, sprints: bd.sprints.filter(sp => sp.id !== sprintId) } } }
      })
    } catch (err) {
      set({ apiError: err.message })
    }
  },

  setTaskSprint: async (taskId, sprintId, boardId) => {
    try {
      await api.setTaskSprint(taskId, sprintId)
      // Reload backlog data and board data
      if (boardId) {
        await get().loadSprints(boardId)
        await get().loadBoard(boardId)
      }
    } catch (err) {
      set({ apiError: err.message })
    }
  },

  // helper — find boardId for a sprintId from cached data
  _sprintBoardId: (sprintId) => {
    const { sprintData } = get()
    for (const [boardId, data] of Object.entries(sprintData)) {
      if (data.sprints?.some(sp => sp.id === sprintId)) return boardId
    }
    return null
  },
}))

setUnauthorizedHandler(() => useStore.getState().logout())
