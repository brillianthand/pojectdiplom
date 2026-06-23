import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  X, Calendar, Tag as TagIcon, Users, Trash2, Pencil, Check,
  MessageSquare, ArrowUp, AlignLeft, ChevronDown, Plus, MoreHorizontal, Clock, Archive,
  Activity, ArrowRight, ArrowRightLeft, UserPlus, UserMinus, Sparkles, ListChecks, Star,
  Paperclip, FileText, Image, Download,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BASE } from '../../api/index'
import { Avatar } from '../ui/Avatar'
import { PriorityIcon, PRIORITIES, PRIORITY_BY_VALUE } from '../ui/PriorityIcon'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { formatDate } from '../../utils/date'
import { usePermissions, can as roleCan } from '../../lib/permissions'
import { addRecent } from '../../utils/recents'

const TAG_TEMPLATES = ['design', 'dev', 'research']

const PRIORITY_PILL_BG = {
  urgent: 'bg-[rgba(229,72,77,0.10)] text-[#DC2626]',
  high:   'bg-[rgba(245,165,36,0.12)] text-[#B45309]',
  medium: 'bg-[rgba(94,106,210,0.10)] text-[#3D4AB8]',
  low:    'bg-[rgba(22,163,74,0.10)]  text-[#15803D]',
  none:   'bg-surface-3 text-fg-secondary',
}

function PropertyRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 min-h-[28px]">
      <div className="flex items-center gap-1.5 w-24 flex-shrink-0 text-fg-primary pt-1">
        <Icon size={13} strokeWidth={1.75} />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 pt-0.5">{children}</div>
    </div>
  )
}

function PriorityDropdown({ value, onChange, readOnly }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const meta = PRIORITY_BY_VALUE[value || 'none']

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (readOnly) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${PRIORITY_PILL_BG[meta.value]}`}>
        <PriorityIcon priority={meta.value} size={14} />
        {meta.label}
      </span>
    )
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors hover:opacity-90 ${PRIORITY_PILL_BG[meta.value]}`}
      >
        <PriorityIcon priority={meta.value} size={14} />
        {meta.label}
        <ChevronDown size={12} strokeWidth={2} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-surface-2 border border-line rounded-lg shadow-xl z-50 min-w-[180px] py-1 animate-fade-in">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => { onChange(p.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
            >
              <PriorityIcon priority={p.value} size={13} />
              <span className="flex-1 text-left">{p.label}</span>
              {(value || 'none') === p.value && <Check size={12} className="text-accent" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AssigneePicker({ assignees, projectMembers, pool, onToggle, readOnly }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Chips render from the full project list so previously-assigned members
  // stay visible even after a role downgrade made them ineligible to be picked.
  const selected = assignees
    .map(id => projectMembers.find(m => m.id === id))
    .filter(Boolean)

  // Dropdown options are restricted to executor+ via `pool`.
  const dropdownPool = pool ?? projectMembers

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {selected.length === 0 ? (
          <span className="text-xs text-fg-muted">Никого не назначено</span>
        ) : selected.map(m => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-surface-3 text-sm text-fg-primary"
          >
            <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="sm" />
            {m.name}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1.5 flex-wrap">
      {selected.map(m => (
        <button
          key={m.id}
          onClick={() => onToggle(m.id)}
          className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-surface-3 hover:bg-surface-1 hover:ring-1 hover:ring-line-strong transition-all text-sm text-fg-primary"
          title="Убрать"
        >
          <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="sm" />
          {m.name}
        </button>
      ))}
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
      >
        <Plus size={12} strokeWidth={2} />
        {selected.length === 0 ? 'Назначить' : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-surface-2 border border-line rounded-lg shadow-xl z-50 min-w-[220px] py-1 animate-fade-in">
          {dropdownPool.length === 0 && (
            <div className="px-3 py-2 text-xs text-fg-muted">Нет подходящих участников</div>
          )}
          {dropdownPool.map(m => {
            const active = assignees.includes(m.id)
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
              >
                <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="sm" />
                <span className="flex-1 text-left truncate">{m.name}</span>
                {active && <Check size={12} className="text-accent" strokeWidth={2.5} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TagsPicker({ tags, onToggle, readOnly }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) { setInput(''); return }
    inputRef.current?.focus()
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAdd = (value) => {
    const v = value.trim()
    if (v && !tags.includes(v)) onToggle(v)
    setInput('')
  }

  const suggestions = TAG_TEMPLATES.filter(t => !tags.includes(t) && t.includes(input.toLowerCase()))

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {tags.length === 0 ? (
          <span className="text-xs text-fg-muted">Нет тегов</span>
        ) : tags.map(t => (
          <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-3 text-xs text-fg-secondary">
            {t}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1.5 flex-wrap">
      {tags.map(t => (
        <span
          key={t}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-surface-3 text-xs text-fg-secondary"
        >
          {t}
          <button
            onClick={() => onToggle(t)}
            className="w-3.5 h-3.5 grid place-items-center rounded-full hover:bg-line-strong transition-colors"
            title="Убрать"
          >
            <X size={9} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
      >
        <Plus size={12} strokeWidth={2} />
        {tags.length === 0 ? 'Добавить' : ''}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-surface-2 border border-line rounded-lg shadow-xl z-50 w-52 py-2 animate-fade-in">
          <div className="px-2 mb-1">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { handleAdd(input); }
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Новый тег..."
              className="w-full text-sm text-fg-primary bg-surface-3 border border-line rounded-md px-2.5 py-1.5 outline-none focus:border-line-strong placeholder:text-fg-muted"
            />
          </div>
          {suggestions.length > 0 && (
            <>
              <div className="px-3 pt-1 pb-0.5 text-2xs uppercase tracking-wider text-fg-subtle">Шаблоны</div>
              {suggestions.map(t => (
                <button
                  key={t}
                  onClick={() => handleAdd(t)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
                >
                  <Plus size={11} strokeWidth={2} className="text-fg-muted" />
                  {t}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PriorityChip({ value }) {
  const meta = PRIORITY_BY_VALUE[value || 'none']
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface-3 text-fg-secondary text-xs">
      <PriorityIcon priority={meta.value} size={11} />
      {meta.label}
    </span>
  )
}

function ValueChip({ children }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-surface-3 text-fg-secondary text-xs font-medium">
      {children}
    </span>
  )
}

const arrow = <ArrowRight size={11} strokeWidth={2} className="text-fg-muted inline-block mx-0.5 align-[-1px]" />

function describeEvent(ev, members) {
  const p = ev.payload || {}
  const memberName = (id) => {
    if (!id) return 'Пользователь'
    const m = members.find(x => x.id === id)
    return m?.name || 'Пользователь'
  }

  switch (ev.type) {
    case 'created':
      return { icon: Sparkles, text: <>создал задачу</> }
    case 'title_changed':
      return {
        icon: Pencil,
        text: <>переименовал в <ValueChip>«{p.to}»</ValueChip></>,
      }
    case 'description_changed':
      return { icon: AlignLeft, text: <>изменил описание</> }
    case 'priority_changed':
      return {
        icon: PriorityIcon,
        iconProps: { priority: p.to || 'none', size: 13 },
        text: <>изменил приоритет: <PriorityChip value={p.from} /> {arrow} <PriorityChip value={p.to} /></>,
      }
    case 'start_date_changed':
    case 'due_date_changed': {
      const label = ev.type === 'due_date_changed' ? 'дедлайн' : 'дату начала'
      if (!p.from && p.to)  return { icon: Calendar, text: <>установил {label}: <ValueChip>{formatDate(p.to)}</ValueChip></> }
      if (p.from && !p.to)  return { icon: Calendar, text: <>снял {label}</> }
      return { icon: Calendar, text: <>изменил {label}: <ValueChip>{formatDate(p.from)}</ValueChip> {arrow} <ValueChip>{formatDate(p.to)}</ValueChip></> }
    }
    case 'completed_changed':
      return p.completed
        ? { icon: Check,  text: <>отметил задачу выполненной</> }
        : { icon: Clock,  text: <>вернул задачу в работу</> }
    case 'moved':
      return {
        icon: ArrowRightLeft,
        text: <>переместил: <ValueChip>{p.fromColumnTitle || '—'}</ValueChip> {arrow} <ValueChip>{p.toColumnTitle || '—'}</ValueChip></>,
      }
    case 'assignee_added':
      return { icon: UserPlus,  text: <>назначил <ValueChip>{memberName(p.userId)}</ValueChip></> }
    case 'assignee_removed':
      return { icon: UserMinus, text: <>снял <ValueChip>{memberName(p.userId)}</ValueChip></> }
    case 'tag_added':
      return { icon: TagIcon, text: <>добавил тег <ValueChip>«{p.tag}»</ValueChip></> }
    case 'tag_removed':
      return { icon: TagIcon, text: <>удалил тег <ValueChip>«{p.tag}»</ValueChip></> }
    case 'archived':
      return { icon: Archive, text: <>архивировал задачу</> }
    case 'restored':
      return { icon: Archive, text: <>вернул из архива</> }
    default:
      return { icon: Activity, text: <>{ev.type}</> }
  }
}

function ActivityFeed({ events, members }) {
  if (events === null) {
    return <div className="text-xs text-fg-muted py-2">Загрузка…</div>
  }
  if (events.length === 0) {
    return <div className="text-xs text-fg-muted py-2">Пока нет изменений</div>
  }
  return (
    <ol className="flex flex-col">
      {events.map((ev, i) => {
        const d = describeEvent(ev, members)
        const isLast = i === events.length - 1
        const Icon = d.icon
        const actor = ev.userName || 'Пользователь'
        return (
          <li key={ev.id} className="flex gap-3 relative">
            {/* Vertical timeline rail */}
            {!isLast && (
              <span className="absolute left-[11px] top-7 bottom-0 w-px bg-line" aria-hidden="true" />
            )}
            <div className="flex-shrink-0 mt-0.5 w-[22px] h-[22px] grid place-items-center rounded-full bg-surface-3 text-fg-muted ring-2 ring-surface-2">
              {Icon
                ? <Icon size={11} strokeWidth={1.75} {...(d.iconProps || {})} />
                : <Activity size={11} strokeWidth={1.75} />}
            </div>
            <div className="flex-1 min-w-0 pb-3 flex items-baseline flex-wrap gap-x-1.5 gap-y-1">
              <Avatar initials={ev.userInitials || (actor[0] || '?').toUpperCase()} color={ev.userColor} size="sm" />
              <span className="text-sm font-medium text-fg-primary">{actor}</span>
              <span className="text-sm text-fg-secondary flex items-center flex-wrap gap-x-1 gap-y-1">{d.text}</span>
              <span className="ml-auto text-xs text-fg-muted tabular-nums">{ev.time}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SubtasksSection({ taskId, subtasks, onAdd, onToggle, onUpdate, onDelete, readOnly }) {
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  const total = subtasks.length
  const done = subtasks.filter(s => s.completed).length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const handleAdd = () => {
    const v = newTitle.trim()
    if (!v) return
    onAdd(taskId, v)
    setNewTitle('')
  }

  const commitEdit = (st) => {
    const v = editTitle.trim()
    if (v && v !== st.title) onUpdate(taskId, st.id, { title: v })
    setEditingId(null)
  }

  return (
    <div className="mt-4 pt-5 border-t border-line">
      <div className="flex items-center gap-1.5 mb-3 text-fg-primary">
        <ListChecks size={13} strokeWidth={1.75} />
        <span className="text-xs uppercase tracking-wider font-medium">Подзадачи</span>
        {total > 0 && (
          <span className="text-xs text-fg-subtle tabular-nums">{done}/{total}</span>
        )}
      </div>

      {total > 0 && (
        <div className="mb-3 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex flex-col">
        {subtasks.map(st => (
          <div
            key={st.id}
            className="group flex items-center gap-2 py-1 -mx-2 px-2 rounded-md hover:bg-surface-3 transition-colors"
          >
            <button
              onClick={() => { if (!readOnly) onToggle(taskId, st.id, !st.completed) }}
              disabled={readOnly}
              title={st.completed ? 'Отметить незавершённой' : 'Отметить завершённой'}
              className={`flex-shrink-0 flex w-4 h-4 rounded items-center justify-center transition-all ${st.completed ? 'bg-emerald-700' : 'hover:bg-slate-200'} ${readOnly ? 'cursor-default opacity-70' : ''}`}
              style={st.completed ? {} : { boxShadow: 'inset 0 0 0 1.5px #94a3b8' }}
            >
              <Check size={10} strokeWidth={3} className={st.completed ? 'text-white' : 'text-transparent'} />
            </button>

            {editingId === st.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => commitEdit(st)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(st) }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 min-w-0 text-sm text-fg-primary bg-surface-3 border border-line-strong rounded-md px-2 py-1 outline-none"
              />
            ) : (
              <span
                onClick={() => { if (!readOnly) { setEditingId(st.id); setEditTitle(st.title) } }}
                className={`flex-1 min-w-0 text-sm leading-snug break-words ${readOnly ? '' : 'cursor-text'} ${st.completed ? 'line-through text-fg-muted' : 'text-fg-secondary'}`}
              >
                {st.title}
              </span>
            )}

            {!readOnly && (
              <button
                onClick={() => onDelete(taskId, st.id)}
                title="Удалить подзадачу"
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-fg-muted hover:text-danger hover:bg-danger-soft transition-all"
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-2 flex items-center gap-2 -mx-2 px-2 py-1 rounded-md focus-within:bg-surface-3 transition-colors">
          <Plus size={13} strokeWidth={2} className="text-fg-muted flex-shrink-0" />
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            placeholder="Добавить подзадачу..."
            className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-fg-primary placeholder:text-fg-muted"
          />
        </div>
      )}
    </div>
  )
}

/* ---------- AttachmentList — renders saved attachments inside a comment ---------- */
function AttachmentItem({ a }) {
  const url = `${BASE}/api/attachments/${a.id}`
  const isImage = a.contentType?.startsWith('image/')
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-line hover:border-line-strong transition-colors max-w-[260px]">
        <img src={url} alt={a.filename} className="max-w-full max-h-48 object-contain bg-surface-3" />
        <div className="px-2 py-1 text-[11px] text-fg-muted truncate">{a.filename}</div>
      </a>
    )
  }
  return (
    <a
      href={url}
      download={a.filename}
      className="inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg bg-surface-3 border border-line hover:border-line-strong hover:bg-surface-1 transition-colors text-xs text-fg-secondary max-w-[260px]"
    >
      <FileText size={13} strokeWidth={1.75} className="flex-shrink-0 text-fg-muted" />
      <span className="truncate flex-1 min-w-0">{a.filename}</span>
      <span className="text-fg-muted flex-shrink-0">{formatBytes(a.sizeBytes)}</span>
      <Download size={11} strokeWidth={1.75} className="flex-shrink-0 text-fg-muted" />
    </a>
  )
}

function AttachmentList({ attachments }) {
  if (!attachments || attachments.length === 0) return null
  const images = attachments.filter(a => a.contentType?.startsWith('image/'))
  const files  = attachments.filter(a => !a.contentType?.startsWith('image/'))
  return (
    <div className="mt-2 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(a => <AttachmentItem key={a.id} a={a} />)}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(a => <AttachmentItem key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}

/* ---------- CommentText — renders @<userId> as highlighted mentions ---------- */
function CommentText({ text, memberById }) {
  if (!text) return null
  const parts = []
  const re = /@<([^>]+)>/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) })
    const user = memberById[m[1]]
    parts.push({ t: 'mention', name: user?.name || 'Пользователь' })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) })
  return (
    <p className="text-sm leading-relaxed text-fg-secondary whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.t === 'mention'
          ? <span key={i} className="text-accent font-medium">@{p.name}</span>
          : <span key={i}>{p.v}</span>
      )}
    </p>
  )
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES     = 5

function formatBytes(n) {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = e => resolve(e.target.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

/* ---------- MentionComposer — comment input with @mention + file attachments ---------- */
function MentionComposer({ value, onChange, onSend, members, currentUser }) {
  const [suggestions, setSuggestions] = useState([])
  const [mentionStart, setMentionStart] = useState(-1)
  const [query, setQuery]               = useState('')
  const [activeIdx, setActiveIdx]       = useState(0)
  const [pendingFiles, setPendingFiles] = useState([]) // { id, filename, contentType, data, sizeBytes }
  const [dragOver, setDragOver]         = useState(false)
  const inputRef   = useRef(null)
  const fileRef    = useRef(null)
  const mentionMap = useRef({})

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6)
  }, [members, query])

  const addFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList).slice(0, MAX_FILES - pendingFiles.length)
    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE) continue
      const data = await readFileAsDataURL(file).catch(() => null)
      if (!data) continue
      setPendingFiles(prev => [
        ...prev,
        { id: Math.random().toString(36).slice(2), filename: file.name, contentType: file.type, data, sizeBytes: file.size },
      ])
    }
  }, [pendingFiles.length])

  const removeFile = (id) => setPendingFiles(prev => prev.filter(f => f.id !== id))

  const handleChange = (e) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart
    onChange(val)
    const before = val.slice(0, cursor)
    const atIdx  = before.lastIndexOf('@')
    if (atIdx >= 0) {
      const partial = before.slice(atIdx + 1)
      if (!partial.includes(' ') && partial.length < 30) {
        setMentionStart(atIdx); setQuery(partial)
        setSuggestions(members.filter(m => m.name.toLowerCase().includes(partial.toLowerCase())).slice(0, 6))
        setActiveIdx(0); return
      }
    }
    setSuggestions([])
  }

  const insertMention = (member) => {
    const before  = value.slice(0, mentionStart)
    const after   = value.slice(mentionStart + 1 + query.length)
    mentionMap.current[member.name] = member.id
    onChange(before + '@' + member.name + after)
    setSuggestions([])
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + 1 + member.name.length
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const doSend = () => {
    const text = value.trim()
    if (!text && pendingFiles.length === 0) return
    let raw = text
    for (const [name, uid] of Object.entries(mentionMap.current)) {
      raw = raw.split('@' + name).join('@<' + uid + '>')
    }
    onSend(raw, pendingFiles.map(f => ({ filename: f.filename, contentType: f.contentType, data: f.data })))
    mentionMap.current = {}
    setSuggestions([])
    setPendingFiles([])
  }

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')      { e.preventDefault(); if (filtered[activeIdx]) insertMention(filtered[activeIdx]); return }
      if (e.key === 'Escape')     { setSuggestions([]); return }
    }
    if (e.key === 'Enter') { e.preventDefault(); doSend() }
  }

  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItems = items.filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    if (imageItems.length > 0) {
      e.preventDefault()
      addFiles(imageItems.map(item => item.getAsFile()).filter(Boolean))
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const canAddMore = pendingFiles.length < MAX_FILES

  return (
    <div className="mt-4 flex gap-3 items-start">
      <Avatar initials={currentUser?.initials ?? '?'} color={currentUser?.color} avatarUrl={currentUser?.avatarUrl} size="sm" className="mt-1" />
      <div className="flex-1 min-w-0">
        {/* Input row */}
        <div
          className={`relative flex items-center gap-1 bg-surface-3 border rounded-2xl pl-4 pr-1.5 py-1 transition-colors ${dragOver ? 'border-accent bg-accent/5' : 'border-line focus-within:border-line-strong'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Комментарий..."
            className="flex-1 min-w-0 text-sm text-fg-primary bg-transparent outline-none placeholder:text-fg-muted"
          />
          {/* Attach button */}
          {canAddMore && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Прикрепить файл"
                className="w-7 h-7 grid place-items-center rounded-full text-fg-muted hover:text-fg-primary hover:bg-surface-1 transition-colors flex-shrink-0"
              >
                <Paperclip size={14} strokeWidth={1.75} />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = '' }}
              />
            </>
          )}
          <button
            onClick={doSend}
            disabled={!value.trim() && pendingFiles.length === 0}
            title="Отправить (Enter)"
            className="w-7 h-7 grid place-items-center rounded-full bg-accent hover:bg-accent-hover text-white transition-all disabled:opacity-30 disabled:hover:bg-accent flex-shrink-0"
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>

          {/* Mention autocomplete */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 w-52 bg-surface-2 border border-line-strong rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-[0.15em] text-fg-subtle">Упомянуть</div>
              {filtered.map((m, i) => (
                <button
                  key={m.id}
                  onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                    i === activeIdx ? 'bg-accent/10 text-fg-primary' : 'text-fg-secondary hover:bg-surface-3 hover:text-fg-primary'
                  }`}
                >
                  <Avatar initials={m.initials} color={m.color} avatarUrl={m.avatarUrl} size="sm" />
                  <span className="flex-1 text-left truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pending attachments preview */}
        {pendingFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingFiles.map(f => (
              <div key={f.id} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-surface-3 border border-line text-xs text-fg-secondary max-w-[200px]">
                {f.contentType.startsWith('image/') ? (
                  <Image size={12} strokeWidth={1.75} className="flex-shrink-0 text-accent" />
                ) : (
                  <FileText size={12} strokeWidth={1.75} className="flex-shrink-0 text-fg-muted" />
                )}
                <span className="truncate flex-1 min-w-0">{f.filename}</span>
                <span className="text-fg-muted flex-shrink-0">{formatBytes(f.sizeBytes)}</span>
                <button
                  onClick={() => removeFile(f.id)}
                  className="flex-shrink-0 w-4 h-4 grid place-items-center rounded-full hover:bg-line-strong transition-colors text-fg-muted hover:text-danger"
                >
                  <X size={9} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const dateInput =
  'text-sm text-fg-primary bg-transparent hover:bg-surface-3 rounded-md px-2 py-1 outline-none transition-colors tabular-nums focus:bg-surface-3'

const iconBtn =
  'w-8 h-8 grid place-items-center rounded-md text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors'

const iconBtnDanger =
  'w-8 h-8 grid place-items-center rounded-md text-fg-muted hover:text-danger hover:bg-danger-soft transition-colors'

const primaryBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-40 disabled:hover:bg-accent'

const ghostBtn =
  'inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-md text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors'

export function TaskModal() {
  const { activeTaskId, closeTask, getActiveTask, updateTask, addComment, deleteComment, updateComment, deleteTask, archiveTask, currentUser, activeProjectId, projects, members, taskEvents, loadTaskEvents, addSubtask, updateSubtask, deleteSubtask, starredIds, toggleStar } = useStore()
  const projectMembers = members[activeProjectId] ?? []
  const perms = usePermissions()
  const readOnly = !perms.canEditTasks
  const commentReadOnly = !perms.canComment
  const assignablePool = useMemo(
    () => projectMembers.filter(m => m.status !== 'pending' && roleCan.beAssignee(m.role)),
    [projectMembers],
  )
  const task = getActiveTask()
  const events = activeTaskId ? (taskEvents[activeTaskId] ?? null) : null

  const memberById = useMemo(() => Object.fromEntries(projectMembers.map(m => [m.id, m])), [projectMembers])

  const [comment, setComment] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  useEffect(() => {
    if (activeTaskId && activityOpen) loadTaskEvents(activeTaskId)
  }, [activeTaskId, activityOpen, loadTaskEvents])
  const menuRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => {
    if (task) {
      const project = projects.find(p => p.id === activeProjectId)
      const boardName = project?.boards.find(b => b.id === project.activeBoardId)?.name ?? ''
      addRecent({ type: 'task', id: task.id, title: task.title, subtitle: boardName, boardId: project?.activeBoardId, projectId: activeProjectId })
    }
  }, [task?.id, projects, activeProjectId])

  // Синхронизация состояния только при смене задачи
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
    }
  }, [task?.id, task?.title, task?.description])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeTask() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeTask])

  if (!activeTaskId || !task) return null

  const handleTitleBlur = () => {
    setEditingTitle(false)
    if (title.trim() && title !== task.title) updateTask(task.id, { title: title.trim() })
    else setTitle(task.title)
  }

  const toggleTag = (tag) => {
    const tags = task.tags.includes(tag) ? task.tags.filter(t => t !== tag) : [...task.tags, tag]
    updateTask(task.id, { tags })
  }

  const toggleAssignee = (memberId) => {
    const assignees = task.assignees.includes(memberId)
      ? task.assignees.filter(a => a !== memberId)
      : [...task.assignees, memberId]
    updateTask(task.id, { assignees })
  }

  const handleSendComment = (rawText, attachments) => {
    if (!rawText.trim() && (!attachments || attachments.length === 0)) return
    addComment(task.id, rawText.trim(), attachments)
    setComment('')
  }

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
        onClick={e => { if (e.target === overlayRef.current) closeTask() }}
      >
        <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-surface-2 rounded-2xl border border-line-strong shadow-2xl overflow-hidden animate-fade-in">
          {/* Top bar */}
          <div className="flex items-center justify-end px-4 pt-3 pb-1 flex-shrink-0 gap-0.5">
            {(() => {
              const isStar = starredIds.has(task.id)
              return (
                <button
                  onClick={() => toggleStar(task.id)}
                  className={`${iconBtn} ${isStar ? 'text-warning hover:text-warning' : ''}`}
                  title={isStar ? 'Убрать из избранного' : 'В избранное'}
                  aria-pressed={isStar}
                >
                  <Star
                    size={16}
                    strokeWidth={1.75}
                    className={isStar ? 'fill-warning' : ''}
                  />
                </button>
              )
            })()}
            {!readOnly && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className={iconBtn}
                  title="Действия"
                >
                  <MoreHorizontal size={16} strokeWidth={1.75} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-surface-2 border border-line rounded-xl shadow-xl z-50 w-48 py-1 animate-fade-in">
                    <button
                      onClick={() => { setEditingTitle(true); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                      Переименовать
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); archiveTask(task.id) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors"
                    >
                      <Archive size={13} strokeWidth={1.75} />
                      В архив
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button
                      onClick={() => { setConfirmDelete(true); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-soft transition-colors"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                      Удалить задачу
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={closeTask} className={iconBtn} title="Закрыть (Esc)">
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 pb-5">
            {/* Title */}
            <p className="text-xs font-medium text-fg-muted uppercase tracking-widest mb-1">Задача</p>
            {editingTitle ? (
              <div className="-mx-3">
                <textarea
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTitleBlur() }
                    if (e.key === 'Escape') { setEditingTitle(false); setTitle(task.title) }
                  }}
                  rows={1}
                  className="w-full text-2xl font-display-tight text-fg-primary bg-surface-3 border border-line-strong rounded-lg px-3 py-2 resize-none outline-none"
                />
                <div className="flex items-center gap-1 mt-1.5 px-1">
                  <button
                    onMouseDown={e => { e.preventDefault(); handleTitleBlur() }}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-accent hover:bg-accent-hover text-white transition-colors"
                  >
                    <Check size={11} strokeWidth={2.5} /> Сохранить
                  </button>
                  <button
                    onMouseDown={e => { e.preventDefault(); setEditingTitle(false); setTitle(task.title) }}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-md text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
                  >
                    <X size={11} strokeWidth={2} /> Отмена
                  </button>
                </div>
              </div>
            ) : (
              <h2 className="text-2xl font-display-tight text-fg-primary leading-tight break-words">
                {task.title}
              </h2>
            )}

            {/* Priority pill */}
            <div className="mt-3">
              <PriorityDropdown
                value={task.priority}
                onChange={v => updateTask(task.id, { priority: v })}
                readOnly={readOnly}
              />
            </div>

            {/* Properties */}
            <div className="mt-5 flex flex-col gap-2">
              <PropertyRow icon={Users} label="Исполнители">
                <AssigneePicker
                  assignees={task.assignees}
                  projectMembers={projectMembers}
                  pool={assignablePool}
                  onToggle={toggleAssignee}
                  readOnly={readOnly}
                />
              </PropertyRow>

              <PropertyRow icon={Calendar} label="Дедлайн">
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={e => updateTask(task.id, { dueDate: e.target.value || null })}
                  disabled={readOnly}
                  className={`${dateInput} ${readOnly ? 'opacity-60 cursor-default' : ''}`}
                />
              </PropertyRow>

              <PropertyRow icon={Clock} label="Создано">
                <span className="text-sm text-fg-secondary tabular-nums">
                  {task.createdAt
                    ? new Date(task.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                </span>
              </PropertyRow>

              <PropertyRow icon={TagIcon} label="Теги">
                <TagsPicker tags={task.tags} onToggle={toggleTag} readOnly={readOnly} />
              </PropertyRow>
            </div>

            {/* Description */}
            <div className="mt-6 pt-5 border-t border-line">
              <div className="flex items-center gap-1.5 mb-2 text-fg-primary">
                <AlignLeft size={13} strokeWidth={1.75} />
                <span className="text-xs">Описание</span>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    if (description !== (task.description || '')) updateTask(task.id, { description })
                  }
                  if (e.key === 'Escape') setDescription(task.description || '')
                }}
                placeholder={readOnly ? 'Описание не задано' : 'Добавьте описание...'}
                rows={4}
                readOnly={readOnly}
                className="w-full text-sm leading-relaxed text-fg-secondary bg-transparent border-none rounded-md px-0 py-1 resize-none outline-none placeholder:text-fg-muted focus:text-fg-primary"
              />
              {!readOnly && description !== (task.description || '') && (
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={() => updateTask(task.id, { description })}
                    className={primaryBtn}
                  >
                    <Check size={11} strokeWidth={2} />
                    Сохранить
                  </button>
                  <button
                    onClick={() => setDescription(task.description || '')}
                    className={ghostBtn}
                  >
                    Отменить
                  </button>
                  <span className="ml-1 text-xs text-fg-subtle">Ctrl+Enter</span>
                </div>
              )}
            </div>

            {/* Subtasks */}
            <SubtasksSection
              taskId={task.id}
              subtasks={task.subtasks || []}
              onAdd={addSubtask}
              onToggle={(tid, sid, completed) => updateSubtask(tid, sid, { completed })}
              onUpdate={updateSubtask}
              onDelete={deleteSubtask}
              readOnly={readOnly}
            />

            {/* Comments */}
            <div className="mt-4 pt-5 border-t border-line">
              <div className="flex items-center gap-1.5 mb-3 text-fg-primary">
                <MessageSquare size={13} strokeWidth={1.75} />
                <span className="text-xs uppercase tracking-wider font-medium">Комментарии</span>
                {task.comments.length > 0 && (
                  <span className="text-xs text-fg-subtle tabular-nums">{task.comments.length}</span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {task.comments.map(c => (
                  <div key={c.id} className="flex gap-3 group">
                    <Avatar initials={c.authorInitials || c.author} color={c.authorColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-medium text-fg-primary">{c.author}</span>
                        <span className="text-xs text-fg-muted tabular-nums">{c.time}</span>
                        {!commentReadOnly && c.userId === currentUser?.id && editingCommentId !== c.id && (
                          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text) }}
                              className="p-1 rounded text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors"
                            >
                              <Pencil size={11} strokeWidth={1.75} />
                            </button>
                            <button
                              onClick={() => deleteComment(task.id, c.id)}
                              className="p-1 rounded text-fg-muted hover:text-danger hover:bg-danger-soft transition-colors"
                            >
                              <Trash2 size={11} strokeWidth={1.75} />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            autoFocus
                            value={editingCommentText}
                            onChange={e => setEditingCommentText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                if (editingCommentText.trim()) {
                                  updateComment(task.id, c.id, editingCommentText.trim())
                                  setEditingCommentId(null)
                                }
                              }
                              if (e.key === 'Escape') setEditingCommentId(null)
                            }}
                            rows={2}
                            className="w-full text-sm text-fg-primary bg-surface-3 border border-line-strong rounded-md px-3 py-2 resize-none outline-none"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { if (editingCommentText.trim()) { updateComment(task.id, c.id, editingCommentText.trim()); setEditingCommentId(null) } }}
                              className={primaryBtn}
                            >
                              <Check size={11} strokeWidth={2} /> Сохранить
                            </button>
                            <button onClick={() => setEditingCommentId(null)} className={ghostBtn}>
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <CommentText text={c.text} memberById={memberById} />
                          {c.attachments && c.attachments.length > 0 && (
                            <AttachmentList attachments={c.attachments} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer — observers cannot comment */}
              {commentReadOnly ? (
                <p className="mt-3 text-xs text-fg-muted">
                  У вашей роли нет права оставлять комментарии.
                </p>
              ) : (
                <MentionComposer
                  value={comment}
                  onChange={setComment}
                  onSend={handleSendComment}
                  members={projectMembers}
                  currentUser={currentUser}
                />
              )}
            </div>

            {/* Activity feed */}
            <div className="mt-4 pt-5 border-t border-line">
              <button
                onClick={() => setActivityOpen(o => !o)}
                className="flex items-center gap-1.5 mb-3 text-fg-primary hover:text-fg-primary transition-colors"
              >
                <Activity size={13} strokeWidth={1.75} />
                <span className="text-xs uppercase tracking-wider font-medium">Активность</span>
                {Array.isArray(events) && events.length > 0 && (
                  <span className="text-xs text-fg-subtle tabular-nums">{events.length}</span>
                )}
                <ChevronDown
                  size={13}
                  strokeWidth={1.75}
                  className={`transition-transform ${activityOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {activityOpen && <ActivityFeed events={events} members={projectMembers} />}
            </div>
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
    </>
  )
}
