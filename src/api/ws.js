const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/^http/, 'ws')

let socket = null
let reconnectTimer = null
let _boardId = null
let _onEvent = null
let _clientId = null
let _delay = 3000

export function connectBoard(boardId, clientId, onEvent) {
  disconnect()
  _boardId = boardId
  _clientId = clientId
  _onEvent = onEvent
  _connect()
}

function _connect() {
  const token = localStorage.getItem('kanban_token') || ''
  socket = new WebSocket(`${BASE}/api/boards/${_boardId}/ws?token=${token}&clientId=${_clientId}`)

  socket.onopen = () => {
    _delay = 3000
  }

  socket.onmessage = (e) => {
    try { _onEvent?.(JSON.parse(e.data)) } catch { }
  }

  socket.onclose = () => {
    socket = null
    const jittered = _delay * (0.8 + Math.random() * 0.4)
    _delay = Math.min(_delay * 2, 30_000)
    reconnectTimer = setTimeout(() => {
      if (_boardId) _connect()
    }, jittered)
  }

  socket.onerror = () => {
    socket?.close()
  }
}

export function disconnect() {
  clearTimeout(reconnectTimer)
  _boardId = null
  _onEvent = null
  _delay = 3000
  if (socket) {
    socket.onclose = null  // prevent reconnect loop
    socket.close()
    socket = null
  }
}
