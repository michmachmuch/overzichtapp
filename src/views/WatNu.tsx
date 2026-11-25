import { useState } from 'react'
import { api, newId, useLoad } from '../api'
import { addDays, dmy, daysUntil, duration, longDate, parseYmd, relative, toMinutes, ymd } from '../format'
import type { CheckinStatus, LocalData, Status } from '../../shared/types'

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
  if (last && last.date === today) {
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
              {last.date === today ? 'vandaag' : longDate(parseYmd(last.date))} {last.start}–{last.end}
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
  const open = data.todos.filter((t) => !t.done)
  const done = data.todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const update = (todos: LocalData['todos']) => save({ ...data, todos })
  return (
    <section className="panel">
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
      <ul className="todo-list">
        {[...open, ...(showDone ? done : [])].map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
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
      <TodayTime status={status} />
      <Checkins setData={setData} />
      <div className="two-col">
        <Issues status={status} />
        <Todos data={data} save={save} />
      </div>
    </div>
  )
}
