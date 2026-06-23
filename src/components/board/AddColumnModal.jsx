import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store/useStore'

const PRESETS = [
  { color: '#f0fdf4', textColor: '#166534', label: 'Зелёный' },
  { color: '#eff6ff', textColor: '#1d4ed8', label: 'Синий' },
  { color: '#fdf4ff', textColor: '#7e22ce', label: 'Фиолетовый' },
  { color: '#fff7ed', textColor: '#c2410c', label: 'Оранжевый' },
  { color: '#fef2f2', textColor: '#b91c1c', label: 'Красный' },
  { color: '#f0f9ff', textColor: '#0369a1', label: 'Голубой' },
  { color: '#fffbeb', textColor: '#b45309', label: 'Жёлтый' },
  { color: '#f8fafc', textColor: '#475569', label: 'Серый' },
]

export function AddColumnModal({ onClose }) {
  const [title, setTitle] = useState('')
  const [preset, setPreset] = useState(() => PRESETS[Math.floor(Math.random() * PRESETS.length)])
  const addColumn = useStore(s => s.addColumn)

  const handleSubmit = () => {
    if (title.trim()) {
      addColumn(title.trim(), preset.color, preset.textColor)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-2 rounded-2xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-fg-primary">Создать колонку</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-fg-muted hover:text-fg-primary hover:bg-surface-3 transition-colors">
            <X size={15} />
          </button>
        </div>

        <input
          autoFocus
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose() }}
          placeholder="Название колонки..."
          className="w-full text-sm px-3 py-2.5 bg-surface-3 border border-line rounded-xl text-fg-primary placeholder:text-fg-muted outline-none focus:border-accent transition-colors mb-4"
        />

        <p className="text-xs font-medium text-fg-muted mb-2">Цвет</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setPreset(p)}
              className={`h-8 rounded-lg border-2 transition-all ${
                preset.label === p.label ? 'border-accent scale-105' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: p.color }}
              title={p.label}
            >
              <span className="text-xs font-semibold" style={{ color: p.textColor }}>{p.label[0]}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-xl px-3 py-2 mb-4 flex items-center gap-2" style={{ backgroundColor: preset.color }}>
          <span className="text-sm font-semibold" style={{ color: preset.textColor }}>
            {title || 'Новая колонка'}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: preset.textColor + '22', color: preset.textColor }}>0</span>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg-primary hover:bg-surface-3 rounded-lg transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}
