import { useEffect, useRef, useState } from 'react'

const H = 220

/** Track the rendered width so the SVG uses real pixels and text keeps its size. */
function useWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}
const PAD = { top: 16, right: 16, bottom: 28, left: 36 }

function niceMax(v: number) {
  if (v <= 5) return 5
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / step) * step
}

interface BurndownPoint { day: number; date: string; ideal: number; actual: number | null }

export function BurndownChart({ points, total }: { points: BurndownPoint[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, W] = useWidth()
  const max = niceMax(total)
  const n = points.length - 1 || 1
  const x = (i: number) => PAD.left + (i / n) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const ideal = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.ideal)}`).join('')
  const actualPts = points.filter((p) => p.actual !== null)
  const actual = actualPts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p.actual!)}`).join('')
  const ticks = [0, max / 2, max]
  const hp = hover !== null ? points[hover] : null

  return (
    <div className="chart">
      <div className="legend">
        <span><i className="swatch swatch-line" style={{ background: 'var(--series-1)' }} /> Remaining points</span>
        <span><i className="swatch swatch-dash" /> Ideal</span>
      </div>
      <div className="chart-wrap" ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Burndown chart, ${total} points in sprint`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - r.left) / r.width) * W
            const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * n)
            setHover(Math.max(0, Math.min(points.length - 1, i)))
          }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.left - 8} y={y(t) + 4} className="axis-label" textAnchor="end">{t}</text>
            </g>
          ))}
          <text x={PAD.left} y={H - 8} className="axis-label">{points[0]?.date.slice(5)}</text>
          <text x={W - PAD.right} y={H - 8} className="axis-label" textAnchor="end">{points.at(-1)?.date.slice(5)}</text>
          <path d={ideal} className="line-ideal" />
          <path d={actual} className="line-actual" />
          {hp && <line x1={x(hp.day)} x2={x(hp.day)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}
          {hp && hp.actual !== null && <circle cx={x(hp.day)} cy={y(hp.actual)} r={5} className="dot-actual" />}
          {actualPts.length > 0 && hover === null && (
            <circle cx={x(actualPts.at(-1)!.day)} cy={y(actualPts.at(-1)!.actual!)} r={4} className="dot-actual" />
          )}
        </svg>
        {hp && (
          <div className="tooltip" style={{ left: `${(x(hp.day) / W) * 100}%` }}>
            <strong>{hp.date}</strong>
            <div>Remaining: {hp.actual ?? '—'}</div>
            <div className="muted">Ideal: {hp.ideal}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function VelocityChart({ data }: { data: { name: string; points: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, W] = useWidth()
  const max = niceMax(Math.max(1, ...data.map((d) => d.points)))
  const inner = W - PAD.left - PAD.right
  const slot = inner / Math.max(data.length, 1)
  const bw = Math.min(48, slot * 0.6)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const base = y(0)
  return (
    <div className="chart">
      <div className="chart-wrap" ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Velocity: completed points per sprint" onMouseLeave={() => setHover(null)}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.left - 8} y={y(t) + 4} className="axis-label" textAnchor="end">{t}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2
            const h = base - y(d.points)
            const r = Math.min(4, h)
            return (
              <g key={d.name} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={H - PAD.top - PAD.bottom} fill="transparent" />
                {h > 0 && (
                  <path className={`bar ${hover === i ? 'bar-hover' : ''}`}
                    d={`M${cx - bw / 2},${base} V${y(d.points) + r} Q${cx - bw / 2},${y(d.points)} ${cx - bw / 2 + r},${y(d.points)} H${cx + bw / 2 - r} Q${cx + bw / 2},${y(d.points)} ${cx + bw / 2},${y(d.points) + r} V${base} Z`} />
                )}
                <text x={cx} y={H - 8} className="axis-label" textAnchor="middle">{d.name}</text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>{data[hover].name}</strong>
            <div>{data[hover].points} points done</div>
          </div>
        )}
      </div>
    </div>
  )
}
