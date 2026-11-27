import { useEffect, useRef, useState } from 'react'
import { api, newId, useLoad } from '../api'
import { addDays, dmy, daysUntil, duration, longDate, parseYmd, relative, toMinutes, ymd } from '../format'
import type { CheckinStatus, LocalData, Status } from '../../shared/types'
import { currentSprint, nextSprint, sprintProgress } from '../sprint'
import { dragTarget, moveItem, reorderOpen, rowShift, slotOffset, type RowBox } from '../reorder'

interface Props {
  status: Status | null
  data: LocalData
  save: (d: LocalData) => void
  setData: (d: LocalData) => void
}

function Countdowns({ data }: { data: LocalData }) {
  const upcoming = data.deadlines
    .map((d) => ({ ...d, days: daysUntil(d.date) }))
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days)
  if (!upcoming.length) {
    return <p className="muted small">Nog geen deadlines. Voeg ze toe bij <a href="#/instellingen">Instellingen</a>.</p>
  }
  return (
    <div className="countdowns">
      {upcoming.map((d) => (
        <div key={d.id} className={`countdown ${d.days <= 2 ? 'urgent' : d.days <= 7 ? 'soon' : ''}`}>
          <div className="countdown-num">{d.days === 0 ? 'Vandaag' : d.days === 1 ? 'Morgen' : `${d.days} dagen`}</div>
          <div className="countdown-title">{d.title}</div>
          <div className="muted small">{longDate(parseYmd(d.date))}{d.time ? `, ${d.time}` : ''}</div>
        </div>
      ))}
    </div>
  )
}

const STATUS_TEXT = {
  klaar: 'Doel gehaald 🎉',
  voor: 'Je loopt voor',
  'op-schema': 'Je ligt op schema',
  achter: 'Je loopt achter',
} as const

function SprintHours({ status, data }: { status: Status | null; data: LocalData }) {
  const sprint = currentSprint(data.sprints)
  const today = ymd(new Date())
  const range = sprint ?? { start: today, end: today }
  const { data: entries, error, loading } = useLoad(
    () => (sprint && status?.gitlabConfigured ? api.time(range.start, range.end) : Promise.resolve([])),
    [range.start, range.end, status?.gitlabConfigured],
  )
  if (!sprint) {
    const next = nextSprint(data.sprints)
    return (
      <section className="panel sprint-hours">
        <h2>Sprint-uren</h2>
        <p className="muted small">
          {next
            ? <>Er loopt nu geen sprint. <strong>{next.name}</strong> begint op {dmy(next.start)}{next.startTime ? ` om ${next.startTime}` : ''}.</>
            : <>Stel je sprints in bij <a href="#/instellingen">Instellingen</a> om je voortgang naar {data.sprintHoursTarget} uur te zien.</>}
        </p>
      </section>
    )
  }
  const p = sprintProgress(sprint, (entries ?? []).filter((e) => e.mine), data.sprintHoursTarget, today)
  const pct = Math.min(100, (p.loggedMinutes / p.targetMinutes) * 100)
  const expectedPct = Math.min(100, (p.expectedMinutes / p.targetMinutes) * 100)
  const hours = (m: number) => (m / 60).toLocaleString('nl-NL', { maximumFractionDigits: 1 })
  return (
    <section className={`panel sprint-hours status-${p.status}`}>
      <div className="panel-head">
        <div>
          <h2>{sprint.name}</h2>
          <p className="muted small">{dmy(sprint.start)}{sprint.startTime ? ` ${sprint.startTime}` : ''} t/m {dmy(sprint.end)}{sprint.endTime ? ` ${sprint.endTime}` : ''} · nog {p.workdaysLeft} {p.workdaysLeft === 1 ? 'werkdag' : 'werkdagen'}</p>
        </div>
        <div className="sprint-hours-num">
          <strong>{hours(p.loggedMinutes)}</strong> / {data.sprintHoursTarget} uur
        </div>
      </div>
      {error && <p className="error small">Uren konden niet geladen worden: {error}</p>}
      <div
        className="hours-bar"
        role="progressbar"
        aria-label="Gelogde uren deze sprint"
        aria-valuemin={0}
        aria-valuemax={data.sprintHoursTarget}
        aria-valuenow={Math.round(p.loggedMinutes / 60)}
        aria-valuetext={`${hours(p.loggedMinutes)} van ${data.sprintHoursTarget} uur`}
      >
        <div className="hours-fill" style={{ width: `${pct}%` }} />
        {p.status !== 'klaar' && <div className="hours-expected" style={{ left: `${expectedPct}%` }} title={`Verwacht rond vandaag: ${hours(p.expectedMinutes)} uur`} />}
      </div>
      {!loading && (
        <p className="small sprint-hours-status">
          <strong>{STATUS_TEXT[p.status]}</strong>
          {p.status !== 'klaar' && (
            <>
              {' '}· nog {hours(p.remainingMinutes)} uur te gaan
              {p.workdaysLeft > 0 && <>, gemiddeld {duration(p.perDayMinutes)} per werkdag</>}
              {' '}· <span className="muted">streepje = waar je bij een gelijk tempo nu zou zitten ({hours(p.expectedMinutes)} uur)</span>
            </>
          )}
        </p>
      )}
    </section>
  )
}

function TodayTime({ status }: { status: Status | null }) {
  const today = ymd(new Date())
  const from = ymd(addDays(new Date(), -6))
  const { data, error, loading } = useLoad(() => api.time(from, today), [from, today])
  if (!status?.gitlabConfigured) return null
  if (loading) return <div className="panel"><p className="muted small">Uren laden…</p></div>
  if (error) return <div className="panel"><p className="error small">Uren konden niet geladen worden: {error}</p></div>
  const mine = (data ?? []).filter((e) => e.mine)
  const todays = mine.filter((e) => e.date === today)
  const total = todays.reduce((s, e) => s + e.durationMinutes, 0)
  const last = mine.at(-1)
  let gap: string | null = null
  if (last && last.date === today && last.end) {
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes() - toMinutes(last.end)
    if (mins > 15) gap = duration(mins)
  }
  return (
    <section className="panel time-today">
      <div>
        <div className="stat-label">Vandaag gelogd</div>
        <div className="stat-value">{duration(total)}</div>
      </div>
      <div className="grow">
        {last ? (
          <>
            <div className="small">
              Laatste activiteit: <strong>{last.note || 'zonder notitie'}</strong>
            </div>
            <div className="muted small">
              {last.date === today ? 'vandaag' : longDate(parseYmd(last.date))} {last.start ? `${last.start}–${last.end}` : `${duration(last.durationMinutes)}, zonder starttijd`}
              {gap && <> · <span className="warn">sindsdien {gap} niet gelogd</span></>}
            </div>
          </>
        ) : (
          <div className="muted small">De afgelopen week nog niets gelogd.</div>
        )}
      </div>
      <a className="btn" href="#/tijd">Bekijk agenda</a>
    </section>
  )
}

function CheckinCard({ c, onChecked }: { c: CheckinStatus; onChecked: () => void }) {
  const [open, setOpen] = useState(false)
  const hasNew = (c.newCount ?? 0) > 0
  return (
    <li className={`checkin ${hasNew ? 'has-new' : ''}`}>
      <div className="checkin-main">
        <div className="checkin-head">
          <strong>{c.title}</strong>
          {c.newCount !== null && (
            <button className={`badge-new ${hasNew ? '' : 'zero'}`} onClick={() => setOpen((o) => !o)} disabled={!hasNew} aria-expanded={open}>
              {c.newCount} nieuw{hasNew ? (open ? ' ▴' : ' ▾') : ''}
            </button>
          )}
        </div>
        <p className="muted small">{c.info}</p>
        {c.error && <p className="error small">{c.error}</p>}
        {open && hasNew && (
          <ul className="new-items">
            {c.newItems.map((i) => (
              <li key={i.url}><a href={i.url} target="_blank" rel="noreferrer">{i.title}</a> <span className="muted small">{relative(i.createdAt)}</span></li>
            ))}
          </ul>
        )}
        <p className="muted tiny">Laatst gecheckt: {relative(c.lastCheckedAt)}</p>
      </div>
      <div className="checkin-actions">
        {c.url && <a className="btn" href={c.url} target="_blank" rel="noreferrer">Openen ↗</a>}
        <button className="btn btn-primary" onClick={onChecked}>Gecheckt ✓</button>
      </div>
    </li>
  )
}

function Checkins({ setData }: { setData: (d: LocalData) => void }) {
  const { data, error, loading, reload, setData: setList } = useLoad(() => api.checkins())
  const mark = async (id: string) => {
    if (data) setList(data.map((c) => (c.id === id ? { ...c, newCount: c.newCount === null ? null : 0, newItems: [], lastCheckedAt: new Date().toISOString() } : c)))
    setData(await api.markChecked(id))
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Check-ins</h2>
        <button className="btn btn-ghost small" onClick={reload} disabled={loading}>{loading ? 'Laden…' : '↻ Vernieuwen'}</button>
      </div>
      {error && <p className="error small">{error}</p>}
      {data && (
        <ul className="checkins">
          {data.map((c) => <CheckinCard key={c.id} c={c} onChecked={() => mark(c.id)} />)}
        </ul>
      )}
    </section>
  )
}

function Issues({ status }: { status: Status | null }) {
  const { data, error, loading } = useLoad(() => (status?.gitlabConfigured ? api.issues() : Promise.resolve([])), [status?.gitlabConfigured])
  return (
    <section className="panel">
      <h2>Mijn GitLab-issues</h2>
      {!status?.gitlabConfigured && <p className="muted small">Koppel GitLab om je issues te zien.</p>}
      {loading && status?.gitlabConfigured && <p className="muted small">Laden…</p>}
      {error && <p className="error small">{error}</p>}
      {data && data.length === 0 && status?.gitlabConfigured && <p className="muted small">Er zijn geen open issues aan jou toegewezen.</p>}
      <ul className="issue-list">
        {data?.map((i) => (
          <li key={i.iid}>
            <a href={i.url} target="_blank" rel="noreferrer"><span className="muted">#{i.iid}</span> {i.title}</a>
            <div className="labels">
              {i.labels.map((l) => <span key={l} className="label">{l}</span>)}
              {i.dueDate && <span className="label label-due">deadline {dmy(i.dueDate)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Todos({ data, save }: { data: LocalData; save: (d: LocalData) => void }) {
  const [title, setTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const savedOpen = data.todos.filter((t) => !t.done)
  const done = data.todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const update = (todos: LocalData['todos']) => save({ ...data, todos })
  // Dragging: the row you hold follows the pointer, the rows in between slide aside, and it settles where you let go.
  // Let go outside the to-do box and it flies back. The row order only changes (and is saved) once it has settled.
  type Drag = {
    id: string; start: number; dx: number; dy: number; target: number; outside: boolean; settling: boolean
    /** Positions of the open rows and of the pointer when the drag started. */
    geo: { rows: RowBox[]; x: number; y: number }
  }
  const [drag, setDragState] = useState<Drag | null>(null)
  // The same value, readable right away by pointer events that arrive before React re-renders.
  const dragRef = useRef<Drag | null>(null)
  const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d) }
  const rows = useRef(new Map<string, HTMLLIElement>())
  const box = useRef<HTMLElement>(null)
  const open = savedOpen
  const saveOrder = (ids: string[]) => update(reorderOpen(data.todos, ids))
  const SETTLE_MS = 180
  const onDragMove = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d || d.settling) return
    const { geo } = d
    const dx = e.clientX - geo.x
    const dy = e.clientY - geo.y
    const r = box.current?.getBoundingClientRect()
    const outside = !!r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    const held = geo.rows[d.start]
    const target = outside ? d.start : dragTarget(d.start, (held.top + held.bottom) / 2 + dy, geo.rows)
    setDrag({ ...d, dx, dy, target, outside })
  }
  const onDragEnd = () => {
    const d = dragRef.current
    if (!d || d.settling) return
    // Glide into the new slot (or back to the old one), then apply the new order.
    setDrag({ ...d, settling: true, dx: 0, dy: slotOffset(d.start, d.target, d.geo.rows) })
    window.setTimeout(() => {
      if (d.target !== d.start) saveOrder(moveItem(savedOpen.map((t) => t.id), d.start, d.target))
      setDrag(null)
    }, SETTLE_MS)
  }
  const cancelDrag = () => {
    const d = dragRef.current
    if (d && !d.settling) { setDrag({ ...d, target: d.start }); onDragEnd() }
  }
  const startDrag = (e: React.PointerEvent, id: string, index: number) => {
    if (e.button !== 0 || dragRef.current) return
    e.preventDefault()
    const geo = {
      rows: savedOpen.map((t) => { const r = rows.current.get(t.id)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } }),
      x: e.clientX,
      y: e.clientY,
    }
    setDrag({ id, start: index, dx: 0, dy: 0, target: index, outside: false, settling: false, geo })
  }
  // Follow the pointer on the whole window while dragging, so it keeps working outside the handle.
  const handlers = useRef({ move: onDragMove, end: onDragEnd, cancel: cancelDrag })
  useEffect(() => { handlers.current = { move: onDragMove, end: onDragEnd, cancel: cancelDrag } })
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => handlers.current.move(e)
    const end = () => handlers.current.end()
    const cancel = () => handlers.current.cancel()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', key)
    }
  }, [dragging])
  const rowStyle = (i: number, t: { id: string; done: boolean }): React.CSSProperties | undefined => {
    if (!drag || t.done) return undefined
    if (t.id === drag.id) return { transform: `translate(${drag.dx}px, ${drag.dy}px)` }
    const shift = rowShift(i, drag.start, drag.target, drag.geo.rows)
    return shift ? { transform: `translateY(${shift}px)` } : undefined
  }
  const onHandleKey = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null
    if (to === null || to < 0 || to >= savedOpen.length) return
    e.preventDefault()
    saveOrder(moveItem(savedOpen.map((t) => t.id), index, to))
    const handle = e.currentTarget
    requestAnimationFrame(() => handle.focus())
  }
  return (
    <section className="panel" ref={box}>
      <h2>Eigen to-do's</h2>
      <form className="inline-form" onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        update([...data.todos, { id: newId(), title: title.trim(), note: '', done: false, createdAt: new Date().toISOString(), doneAt: null }])
        setTitle('')
      }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. leerdoelen bijwerken, reflectie schrijven…" aria-label="Nieuwe to-do" />
        <button className="btn btn-primary" type="submit">Toevoegen</button>
      </form>
      {open.length === 0 && <p className="muted small">Geen open to-do's.</p>}
      <ul className={`todo-list ${drag ? 'is-dragging' : ''}`}>
        {[...open, ...(showDone ? done : [])].map((t, i) => (
          <li
            key={t.id}
            ref={(el) => { if (el) rows.current.set(t.id, el); else rows.current.delete(t.id) }}
            className={`${t.done ? 'done' : ''} ${drag?.id === t.id ? `dragging ${drag.settling ? 'settling' : ''} ${drag.outside ? 'outside' : ''}` : ''}`}
            style={rowStyle(i, t)}
          >
            {!t.done && open.length > 1 && (
              <button
                type="button"
                className="drag-handle"
                aria-label={`Verplaats ${t.title} (pijltjestoetsen omhoog/omlaag)`}
                title="Sleep om de volgorde te veranderen"
                onPointerDown={(e) => startDrag(e, t.id, i)}
                onKeyDown={(e) => onHandleKey(e, i)}
              >⋮⋮</button>
            )}
            <label>
              <input type="checkbox" checked={t.done} onChange={() => update(data.todos.map((x) => x.id === t.id ? { ...x, done: !x.done, doneAt: x.done ? null : new Date().toISOString() } : x))} />
              <span>{t.title}</span>
            </label>
            <button className="icon-btn" aria-label={`Verwijder ${t.title}`} onClick={() => update(data.todos.filter((x) => x.id !== t.id))}>✕</button>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <button className="btn btn-ghost small" onClick={() => setShowDone((s) => !s)}>
          {showDone ? 'Verberg afgeronde' : `Toon afgeronde (${done.length})`}
        </button>
      )}
    </section>
  )
}

export function WatNu({ status, data, save, setData }: Props) {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Wat nu?</h1>
          <p className="muted">{greeting}{status?.user ? `, ${status.user.name.split(' ')[0]}` : ''}. Het is {longDate(now)}.</p>
        </div>
      </header>
      <Countdowns data={data} />
      <SprintHours status={status} data={data} />
      <TodayTime status={status} />
      <Checkins setData={setData} />
      <div className="two-col">
        <Issues status={status} />
        <Todos data={data} save={save} />
      </div>
    </div>
  )
}
