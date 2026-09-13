import { useState } from 'react'

/**
 * Scans par jour — série unique, donc pas de légende : le titre nomme la mesure.
 * Barres ancrées à la ligne de base, sommet arrondi (4 px), grille discrète.
 */
export default function ScanChart({ data, color = '#6d28d9' }) {
  const [hover, setHover] = useState(null)
  const width = 700
  const height = 220
  const padding = { top: 16, right: 16, bottom: 28, left: 32 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const max = Math.max(1, ...data.map((point) => point.value))
  const ticks = [0, Math.round(max / 2), max].filter((value, index, list) => list.indexOf(value) === index)
  const slot = plotWidth / data.length
  const barWidth = Math.max(4, Math.min(28, slot - 6))

  const barPath = (x, y, w, h, r) => {
    const radius = Math.min(r, h, w / 2)
    return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Scans par jour sur les 14 derniers jours">
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - (tick / max) * plotHeight
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e8eaf2" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-ink-400" style={{ fontSize: 11, fontWeight: 600 }}>
                {tick}
              </text>
            </g>
          )
        })}

        {data.map((point, index) => {
          const barHeight = (point.value / max) * plotHeight
          const x = padding.left + index * slot + (slot - barWidth) / 2
          const y = padding.top + plotHeight - barHeight
          const active = hover === index
          return (
            <g key={point.label} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
              <rect x={padding.left + index * slot} y={padding.top} width={slot} height={plotHeight} fill="transparent" />
              {point.value > 0 && (
                <path d={barPath(x, y, barWidth, barHeight, 4)} fill={color} opacity={active ? 1 : 0.85} />
              )}
              {index % 2 === 0 && (
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-ink-400" style={{ fontSize: 10, fontWeight: 600 }}>
                  {point.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-ink-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-lift"
          style={{ left: `${((padding.left + hover * slot + slot / 2) / width) * 100}%`, top: '8px' }}
        >
          {data[hover].value} scan{data[hover].value > 1 ? 's' : ''} — {data[hover].full}
        </div>
      )}
    </div>
  )
}
