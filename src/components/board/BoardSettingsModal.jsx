import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown } from 'lucide-react'
import { useStore } from '../../store/useStore'

const TABS = [
  { id: 'general', label: 'Основные' },
]

const ARCHIVE_PRESETS = [1, 3, 7, 14, 30]

function dayWord(n) {
  const m = n % 10, t = n % 100
  if (m === 1 && t !== 11) return 'день'
  if (m >= 2 && m <= 4 && (t < 10 || t >= 20)) return 'дня'
  return 'дней'
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-150 ring-1 ring-inset ${
        checked
          ? 'bg-emerald-500 ring-emerald-600/30'
          : 'bg-black/10 ring-black/15'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SelectButton({ label, open, setOpen, disabled, children }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-line bg-surface-2 hover:border-line-strong transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <span className="text-fg-primary truncate max-w-[180px]">{label}</span>
        <ChevronDown size={11} strokeWidth={1.75} className={`text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  )
}

function ColumnSelect({ value, columns, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const lastCol = columns[columns.length - 1]
  const selected = columns.find(c => c.id === value)
  const label = selected ? selected.title : 'Последняя колонка'

  return (
    <SelectButton label={label} open={open} setOpen={setOpen} disabled={disabled}>
      <div className="absolute top-full right-0 mt-1 min-w-[240px] max-h-[260px] overflow-y-auto bg-surface-2 hairline-strong rounded-md shadow-xl z-10 py-1">
        <button
          onClick={() => { onChange(''); setOpen(false) }}
          className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
            !value ? 'bg-surface-3 text-fg-primary' : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3'
          }`}
        >
          <span className="flex-1 truncate">Последняя колонка</span>
          {lastCol && <span className="text-xs text-fg-muted truncate max-w-[100px]">{lastCol.title}</span>}
        </button>
        {columns.length > 0 && <div className="my-1 hairline-t" />}
        {columns.map(c => (
          <button
            key={c.id}
            onClick={() => { onChange(c.id); setOpen(false) }}
            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
              value === c.id ? 'bg-surface-3 text-fg-primary' : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3'
            }`}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            <span className="truncate">{c.title}</span>
          </button>
        ))}
      </div>
    </SelectButton>
  )
}

function DaysSelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  return (
    <SelectButton
      label={`${value} ${dayWord(value)}`}
      open={open}
      setOpen={setOpen}
      disabled={disabled}
    >
      <div className="absolute top-full right-0 mt-1 min-w-[140px] bg-surface-2 hairline-strong rounded-md shadow-xl z-10 py-1">
        {ARCHIVE_PRESETS.map(n => (
          <button
            key={n}
            onClick={() => { onChange(n); setOpen(false) }}
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors tabular-nums ${
              value === n ? 'bg-surface-3 text-fg-primary' : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-3'
            }`}
          >
            {n} {dayWord(n)}
          </button>
        ))}
      </div>
    </SelectButton>
  )
}

function SettingRow({ title, hint, control }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 hairline-b last:hairline-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg-primary font-medium">{title}</p>
        {hint && <p className="text-xs text-fg-muted mt-1 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

function GeneralTab({ board }) {
  const updateBoardSettings = useStore(s => s.updateBoardSettings)
  const settings = board?.settings || {}
  const autoMoveOn = !!settings.autoMoveOnComplete
  const autoArchiveOn = !!settings.autoArchiveEnabled
  const archiveDays = settings.autoArchiveDays || 7

  return (
    <section className="flex flex-col gap-10">
      {/* Block 1 — Auto-move */}
      <div>
        <h3 className="text-sm font-medium text-fg-primary mb-1">Перемещать при выполнении</h3>
        <p className="text-xs text-fg-muted mb-3 leading-relaxed">
          Когда задача отмечается как выполненная, она автоматически уезжает в выбранную колонку.
        </p>
        <div className="rounded-lg border border-line bg-surface-2/60 px-5">
          <SettingRow
            title="Включить автоматическое перемещение"
            control={
              <Toggle
                checked={autoMoveOn}
                onChange={(v) => updateBoardSettings({ autoMoveOnComplete: v })}
              />
            }
          />
          <SettingRow
            title="Целевая колонка"
            hint="Если не выбрана — задача уедет в самую правую колонку."
            control={
              <ColumnSelect
                value={settings.autoMoveColumnId || ''}
                columns={board.columns || []}
                disabled={!autoMoveOn}
                onChange={(id) => updateBoardSettings({ autoMoveColumnId: id })}
              />
            }
          />
        </div>
      </div>

      {/* Block 2 — Auto-archive */}
      <div>
        <h3 className="text-sm font-medium text-fg-primary mb-1">Автоархивирование</h3>
        <p className="text-xs text-fg-muted mb-3 leading-relaxed">
          Выполненные задачи уходят в архив, когда они пролежали выполненными дольше выбранного срока.
        </p>
        <div className="rounded-lg border border-line bg-surface-2/60 px-5">
          <SettingRow
            title="Включить автоархивирование"
            control={
              <Toggle
                checked={autoArchiveOn}
                onChange={(v) => updateBoardSettings({ autoArchiveEnabled: v })}
              />
            }
          />
          <SettingRow
            title="Архивировать через"
            hint="Срок отсчитывается от момента, когда задача была отмечена выполненной."
            control={
              <DaysSelect
                value={archiveDays}
                disabled={!autoArchiveOn}
                onChange={(n) => updateBoardSettings({ autoArchiveDays: n })}
              />
            }
          />
        </div>
      </div>
    </section>
  )
}

export function BoardSettingsModal({ board, onClose }) {
  const [tab, setTab] = useState('general')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!board) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans animate-fade-in p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-3xl h-[640px] max-h-[90vh] bg-bg rounded-2xl shadow-2xl hairline-strong flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-7 py-5 hairline-b flex-shrink-0">
          <h1 className="text-2xl font-display-tight text-fg-primary truncate min-w-0">
            Настройки доски «{board.name}»
          </h1>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 grid place-items-center rounded-md text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors flex-shrink-0"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body — tabs + content */}
        <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr]">
          <nav className="hairline-r p-3 flex flex-col gap-1 bg-surface-1/40">
            {TABS.map(({ id, label }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-surface-3 text-fg-primary font-medium'
                      : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-2'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="overflow-y-auto px-8 py-8">
            {tab === 'general' && <GeneralTab board={board} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
