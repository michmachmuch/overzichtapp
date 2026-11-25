/** 24-hour time picker (HH:MM). The browser's own time field follows the system locale and can show AM/PM. */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [h, m] = value ? value.split(':') : ['', '']
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES
  return (
    <span className="time-select" role="group" aria-label={label}>
      <select value={h} aria-label="Uur" onChange={(e) => onChange(e.target.value ? `${e.target.value}:${m || '00'}` : '')}>
        <option value="">--</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span>:</span>
      <select value={m} aria-label="Minuten" disabled={!h} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {!h && <option value="">--</option>}
        {minutes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  )
}
