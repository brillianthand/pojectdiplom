import { useEffect, useMemo, useState } from 'react'
import {
  Search, Lock, Unlock, Trash2, Sparkles,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'
import { ConfirmDialog } from '../ui/ConfirmDialog'

const FILTERS = [
  { id: 'all',     label: 'Все' },
  { id: 'active',  label: 'Активные' },
  { id: 'blocked', label: 'Заблокированные' },
  { id: 'admins',  label: 'Администраторы' },
]

function pluralRu(n, [one, few, many]) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function relative(dateStr) {
  if (!dateStr) return 'нет данных'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${pluralRu(h, ['час', 'часа', 'часов'])} назад`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} ${pluralRu(d, ['день', 'дня', 'дней'])} назад`
  const mo = Math.floor(d / 30)
  return `${mo} ${pluralRu(mo, ['месяц', 'месяца', 'месяцев'])} назад`
}

function StatusDot({ blocked }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${blocked ? 'bg-[#E5484D]' : 'bg-[#16A34A]'}`}
        style={blocked ? {} : { boxShadow: '0 0 0 3px rgba(22,163,74,0.16)' }}
      />
      <span className={`text-xs ${blocked ? 'text-fg-secondary' : 'text-fg-secondary'}`}>
        {blocked ? 'Заблокирован' : 'Активен'}
      </span>
    </span>
  )
}

function RoleBadge({ isAdmin }) {
  if (!isAdmin) {
    return <span className="text-xs font-mono uppercase tracking-[0.14em] text-fg-primary">user</span>
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono uppercase tracking-[0.14em] bg-accent text-white">
      <Sparkles size={9} strokeWidth={2} />
      admin
    </span>
  )
}

export function AdminView() {
  const {
    adminUsers, adminLoading, loadAdmin,
    adminUpdateUser, adminDeleteUser, currentUser,
  } = useStore()

  const [query, setQuery]     = useState('')
  const [filter, setFilter]   = useState('all')
  const [confirm, setConfirm] = useState(null) // { user, action }

  useEffect(() => { loadAdmin() }, [])

  const filtered = useMemo(() => {
    let list = adminUsers
    if (filter === 'active')  list = list.filter(u => !u.isBlocked)
    if (filter === 'blocked') list = list.filter(u =>  u.isBlocked)
    if (filter === 'admins')  list = list.filter(u =>  u.isAdmin)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
    return list
  }, [adminUsers, filter, query])

  return (
    <div className="h-full overflow-y-auto bg-surface-1">
      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display-tight text-4xl text-fg-primary">Пользователи</h1>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск по имени или email…"
              className="w-full bg-surface-2 hairline rounded-md pl-9 pr-3 py-2 text-sm text-fg-primary placeholder:text-fg-subtle outline-none focus:hairline-strong transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-surface-2 hairline rounded-md p-0.5">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-[0.14em] rounded transition-colors ${
                  filter === f.id
                    ? 'bg-accent text-white'
                    : 'text-fg-secondary hover:text-fg-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-2 hairline rounded-md overflow-hidden w-fit max-w-full">
          <div className="grid grid-cols-[240px_90px_120px_80px_120px_140px_72px] gap-x-6 px-5 py-3 hairline-b text-xs font-medium text-fg-secondary">
            <div>Пользователь</div>
            <div>Роль</div>
            <div>Статус</div>
            <div>Проектов</div>
            <div>Регистрация</div>
            <div>Активность</div>
            <div />
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-fg-muted">
              {adminLoading ? 'Загружаю…' : 'Никого не найдено'}
            </div>
          ) : (
            filtered.map(u => {
              const isMe = u.id === currentUser?.id
              return (
                <div
                  key={u.id}
                  className="relative grid grid-cols-[240px_90px_120px_80px_120px_140px_72px] gap-x-6 px-5 py-3 hairline-b last:border-b-0 items-center transition-colors hover:bg-surface-3/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar initials={u.initials} color={u.color} avatarUrl={u.avatarUrl} size="md" />
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm text-fg-primary truncate font-medium">{u.name}</span>
                        {isMe && (
                          <span className="text-2xs font-mono uppercase tracking-[0.14em] text-fg-subtle">вы</span>
                        )}
                      </div>
                      <span className="text-xs text-fg-muted truncate">{u.email}</span>
                    </div>
                  </div>

                  <div><RoleBadge isAdmin={u.isAdmin} /></div>
                  <div><StatusDot blocked={u.isBlocked} /></div>
                  <div className="text-sm text-fg-secondary tabular-nums">{u.projectsCount}</div>
                  <div className="text-xs text-fg-secondary tabular-nums">{fmtDate(u.createdAt)}</div>
                  <div className="text-xs text-fg-muted truncate">{relative(u.lastActivity)}</div>

                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        if (u.isBlocked) adminUpdateUser(u.id, { isBlocked: false })
                        else setConfirm({ user: u, action: 'block' })
                      }}
                      disabled={isMe}
                      title={isMe ? 'Нельзя заблокировать себя' : (u.isBlocked ? 'Разблокировать' : 'Заблокировать')}
                      className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-muted"
                    >
                      {u.isBlocked
                        ? <Unlock size={14} strokeWidth={1.75} />
                        : <Lock   size={14} strokeWidth={1.75} />}
                    </button>
                    <button
                      onClick={() => setConfirm({ user: u, action: 'delete' })}
                      disabled={isMe}
                      title={isMe ? 'Нельзя удалить себя' : 'Удалить'}
                      className="w-7 h-7 grid place-items-center rounded text-fg-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-muted"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {confirm?.action === 'delete' && (
        <ConfirmDialog
          title={`Удалить пользователя «${confirm.user.name}»?`}
          message="Учётная запись и все принадлежащие пользователю проекты будут удалены безвозвратно. В задачах его авторство станет анонимным."
          danger
          confirmLabel="Удалить"
          onConfirm={() => { adminDeleteUser(confirm.user.id); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.action === 'block' && (
        <ConfirmDialog
          title={`Заблокировать «${confirm.user.name}»?`}
          message="Пользователь не сможет войти в систему, его сессии будут отклонены при следующем запросе."
          danger={false}
          confirmLabel="Заблокировать"
          onConfirm={() => { adminUpdateUser(confirm.user.id, { isBlocked: true }); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
