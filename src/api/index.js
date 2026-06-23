export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

let _onUnauthorized = () => {}
let _clientId = ''

export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn
}

export function setClientId(id) {
  _clientId = id
}

function getToken() {
  return localStorage.getItem('kanban_token') || ''
}

async function req(method, path, body) {
  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (_clientId) headers['X-Client-ID'] = _clientId
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  if (res.status === 401) {
    _onUnauthorized()
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Unauthorized')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }))
    const err = new Error(data.error || res.statusText)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const api = {
  register:      (data)       => req('POST', '/api/auth/register', data),
  login:         (data)       => req('POST', '/api/auth/login', data),
  me:            ()           => req('GET',  '/api/auth/me'),
  updateProfile: (data)       => req('PUT',  '/api/auth/profile', data),
  changePassword:(data)       => req('POST', '/api/auth/change-password', data),

  seed:          ()           => req('POST', '/api/seed'),

  getUsers:      ()           => req('GET',  '/api/users'),

  getProjects:        ()              => req('GET',  '/api/projects'),
  createProject:      (data)          => req('POST', '/api/projects', data),
  updateProject:      (id, data)      => req('PUT',  `/api/projects/${id}`, data),
  deleteProject:      (id)            => req('DELETE',`/api/projects/${id}`),
  transferOwnership:  (id, userId)    => req('POST', `/api/projects/${id}/transfer-ownership`, { userId }),

  createBoard:   (projectId, data) => req('POST', `/api/projects/${projectId}/boards`, data),
  updateBoard:   (id, data)        => req('PUT',   `/api/boards/${id}`, data),
  deleteBoard:   (id)              => req('DELETE',`/api/boards/${id}`),
  getBoard:      (id)              => req('GET',   `/api/boards/${id}`),
  shareBoard:    (id)              => req('POST',  `/api/boards/${id}/share`),
  updateBoardSettings: (id, settings) => req('PUT', `/api/boards/${id}/settings`, settings),
  reorderColumns:(boardId, ids)    => req('PUT',   `/api/boards/${boardId}/columns/reorder`, ids),

  createColumn:  (boardId, data)   => req('POST', `/api/boards/${boardId}/columns`, data),
  updateColumn:  (id, data)        => req('PUT',  `/api/columns/${id}`, data),
  deleteColumn:  (id)              => req('DELETE',`/api/columns/${id}`),

  getTask:       (id)              => req('GET',  `/api/tasks/${id}`),
  getTaskEvents: (id)              => req('GET',  `/api/tasks/${id}/events`),
  createTask:    (columnId, title) => req('POST', `/api/columns/${columnId}/tasks`, { title }),
  updateTask:    (id, data)        => req('PUT',  `/api/tasks/${id}`, data),
  deleteTask:    (id)              => req('DELETE',`/api/tasks/${id}`),
  moveTask:      (id, data)        => req('PUT',  `/api/tasks/${id}/move`, data),
  duplicateTask: (id)              => req('POST', `/api/tasks/${id}/duplicate`),
  archiveTask:   (id)              => req('POST', `/api/tasks/${id}/archive`),
  restoreTask:   (id)              => req('POST', `/api/tasks/${id}/restore`),
  listArchived:  (boardId)         => req('GET',  `/api/boards/${boardId}/archive`),

  addComment:    (taskId, text, attachments = []) => req('POST', `/api/tasks/${taskId}/comments`, { text, attachments }),
  updateComment: (taskId, cid, text) => req('PUT', `/api/tasks/${taskId}/comments/${cid}`, { text }),
  deleteComment: (id)              => req('DELETE', `/api/comments/${id}`),

  createSubtask: (taskId, title)       => req('POST',   `/api/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (id, data)            => req('PUT',    `/api/subtasks/${id}`, data),
  deleteSubtask: (id)                  => req('DELETE', `/api/subtasks/${id}`),

  getMembers:       (projectId)           => req('GET',    `/api/projects/${projectId}/members`),
  inviteMember:     (projectId, email, role) => req('POST', `/api/projects/${projectId}/members`, { email, role }),
  updateMemberRole: (projectId, userId, role) => req('PATCH', `/api/projects/${projectId}/members/${userId}`, { role }),
  removeMember:     (projectId, userId)   => req('DELETE', `/api/projects/${projectId}/members/${userId}`),

  acceptInvite:  (projectId) => req('POST', `/api/invitations/${projectId}/accept`),
  declineInvite: (projectId) => req('POST', `/api/invitations/${projectId}/decline`),

  starTask:      (id)         => req('POST',   `/api/tasks/${id}/star`),
  unstarTask:    (id)         => req('DELETE', `/api/tasks/${id}/star`),
  getStars:      ()           => req('GET',    '/api/stars'),

  getFeed:       (limit = 20) => req('GET',    `/api/feed?limit=${limit}`),

  getPersonalTasks:    ()         => req('GET',    '/api/personal-tasks'),
  createPersonalTask:  (data)     => req('POST',   '/api/personal-tasks', data),
  updatePersonalTask:  (id, data) => req('PUT',    `/api/personal-tasks/${id}`, data),
  deletePersonalTask:  (id)       => req('DELETE', `/api/personal-tasks/${id}`),

  search:        (q)          => req('GET',  `/api/search?q=${encodeURIComponent(q)}`),

  getWorkspace:  ()           => req('GET',  '/api/workspace'),
  getPresence:   ()           => req('GET',  '/api/presence'),

  getNotifications:      (before) => req('GET', '/api/notifications' + (before ? `?before=${encodeURIComponent(before)}` : '')),
  getNotifCount:         ()  => req('GET', '/api/notifications/count'),
  markNotificationsRead: ()  => req('PUT', '/api/notifications/read'),
  markNotificationRead:  (id)=> req('PUT', `/api/notifications/${id}/read`),

  // ── admin ──
  adminListUsers:  ()           => req('GET',    '/api/admin/users'),
  adminStats:      ()           => req('GET',    '/api/admin/stats'),
  adminPatchUser:  (id, data)   => req('PATCH',  `/api/admin/users/${id}`, data),
  adminDeleteUser: (id)         => req('DELETE', `/api/admin/users/${id}`),

  // ── sprints ──
  getSprints:      (boardId)        => req('GET',    `/api/boards/${boardId}/sprints`),
  createSprint:    (boardId, data)  => req('POST',   `/api/boards/${boardId}/sprints`, data),
  updateSprint:    (id, data)       => req('PUT',    `/api/sprints/${id}`, data),
  startSprint:     (id)             => req('POST',   `/api/sprints/${id}/start`),
  completeSprint:  (id)             => req('POST',   `/api/sprints/${id}/complete`),
  deleteSprint:    (id)             => req('DELETE', `/api/sprints/${id}`),
  setTaskSprint:   (taskId, sprintId) => req('PATCH', `/api/tasks/${taskId}/sprint`, { sprintId }),
}
