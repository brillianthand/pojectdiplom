// Палитра исключает оттенки приоритетов: красный ~358°, оранжевый ~37°, синий ~234°, зелёный ~145°
const TAG_COLORS = [
  { bg: 'hsla(270,60%,92%,1)', fg: 'hsl(270,55%,35%)', dot: 'hsl(270,60%,55%)' }, // purple
  { bg: 'hsla(300,55%,92%,1)', fg: 'hsl(300,50%,32%)', dot: 'hsl(300,55%,50%)' }, // pink
  { bg: 'hsla(330,60%,92%,1)', fg: 'hsl(330,55%,32%)', dot: 'hsl(330,60%,50%)' }, // rose
  { bg: 'hsla(185,60%,88%,1)', fg: 'hsl(185,55%,22%)', dot: 'hsl(185,60%,42%)' }, // cyan
  { bg: 'hsla(205,60%,91%,1)', fg: 'hsl(205,55%,28%)', dot: 'hsl(205,60%,48%)' }, // sky
  { bg: 'hsla(168,55%,87%,1)', fg: 'hsl(168,50%,22%)', dot: 'hsl(168,55%,40%)' }, // teal
  { bg: 'hsla(88, 60%,88%,1)', fg: 'hsl(88, 55%,22%)', dot: 'hsl(88, 60%,40%)' }, // lime
  { bg: 'hsla(65, 65%,88%,1)', fg: 'hsl(65, 60%,24%)', dot: 'hsl(65, 65%,40%)' }, // yellow
  { bg: 'hsla(255,60%,92%,1)', fg: 'hsl(255,55%,35%)', dot: 'hsl(255,60%,52%)' }, // violet
  { bg: 'hsla(315,55%,92%,1)', fg: 'hsl(315,50%,32%)', dot: 'hsl(315,55%,50%)' }, // fuchsia
]

function hashLabel(label) {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return h
}

export function colorsForTags(labels) {
  const n = TAG_COLORS.length
  const used = new Set()
  return labels.map(label => {
    let idx = hashLabel(label) % n
    while (used.has(idx)) idx = (idx + 1) % n
    used.add(idx)
    return TAG_COLORS[idx]
  })
}

export function Tag({ label, color }) {
  const c = color ?? TAG_COLORS[hashLabel(label) % TAG_COLORS.length]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium select-none"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {label}
    </span>
  )
}

import { PriorityIcon, PRIORITY_BY_VALUE } from './PriorityIcon'

export function PriorityBadge({ priority }) {
  const meta = PRIORITY_BY_VALUE[priority] || PRIORITY_BY_VALUE.none
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium select-none text-fg-secondary"
    >
      <PriorityIcon priority={meta.value} size={12} />
      {meta.label}
    </span>
  )
}
