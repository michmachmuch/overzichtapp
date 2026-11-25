import { useState } from 'react'
import { api, useLoad } from '../api'
import { addDays, DAYS_SHORT, duration, isoWeek, MONTHS, parseYmd, startOfWeek, toMinutes, ymd } from '../format'
import type { Status, TimeDiagnosis, TimeEntry } from '../../shared/types'

const HOUR_PX = 48

function readWeek(): Date {
  const m = window.location.hash.match(/week=(\d{4}-\d{2}-\d{2})/)
  return startOfWeek(m ? parseYmd(m[1]) : new Date())
}

function Detail({ e, onClose }: { e: TimeEntry; onClose: () => void }) {
  return (
    <div className="detail panel">
      <div className="panel-head">
        <h2>{e.note || 'Zonder notitie'}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Sluiten">✕</button>
      </div>
      <dl>
        <dt>Wanneer</dt><dd>{e.date}, {e.start}–{e.end} ({duration(e.durationMinutes)})</dd>
        {e.issueIid && <><dt>Issue</dt><dd><a href={e.issueUrl ?? '#'} target="_blank" rel="noreferrer">#{e.issueIid}</a></dd></>}
        {e.processStepId && <><dt>Processtap</dt><dd>{e.processStepId}</dd></>}
        {e.skillId && <><dt>Vaardigheid</dt><dd>{e.skillId}</dd></>}
        <dt>Bestand</dt><dd className="mono small">{e.file}</dd>
      </dl>
      {e.commit ? (
        <a className="btn btn-primary" href={e.commit.url} target="_blank" rel="noreferrer">Open commit {e.commit.shortSha} ↗</a>
      ) : (
        <p className="muted small">Geen commit gevonden voor dit bestand.</p>
      )}
    </div>
  )
}

function Diagnose({ from, to, hiddenByFilter }: { from: string; to: string; hiddenByFilter: number }) {
  const [diag, setDiag] = useState<TimeDiagnosis | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = () => {
    setBusy(true)
    api.diagnoseTime(from, to).then(setDiag, (e: Error) => setErr(e.message)).finally(() => setBusy(false))
  }
  return (
    <section className="panel diagnose">
      <h2>Geen uren te zien?</h2>
      {hiddenByFilter > 0 && (
        <p className="warn small">Er zijn {hiddenByFilter} registraties die niet als "van jou" herkend worden. Zet "Alleen mijn uren" uit om ze te zien.</p>
      )}
      {!diag && <button className="btn" onClick={run} disabled={busy}>{busy ? 'Bezig…' : 'Zoek uit waarom'}</button>}
      {err && <p className="error small">{err}</p>}
      {diag && (
        <div className="small">
          <p><strong>Gezocht op branch:</strong> {diag.branches.join(', ')}</p>
          <ul>
            {diag.folders.map((f) => (
              <li key={f.branch + f.path}><code>{f.path}</code> op <code>{f.branch}</code>: {f.error ?? `${f.files} bestand(en)`}</li>
            ))}
          </ul>
          <p><strong>Registraties in deze week:</strong> {diag.entriesInRange}, waarvan {diag.mine} van jou.</p>
          {Object.keys(diag.userIds).length > 0 && (
            <p>
              <strong>userId's in de registraties:</strong> {Object.entries(diag.userIds).map(([id, n]) => `${id} (${n}×)`).join(', ')}.
              {' '}Jouw GitLab-id is {diag.gitlabUserId}.
              {diag.mine === 0 && <> Zet <code>TIMETRACKING_USER_ID=&lt;jouw id&gt;</code> in <code>.env</code> en herstart.</>}
            </p>
          )}
          {diag.otherBranches.length > 0 && (
            <p className="warn">
              Tijdregistratie-commits gevonden op andere branch(es): <strong>{diag.otherBranches.join(', ')}</strong>.
              {' '}Zet bijv. <code>TIMETRACKING_BRANCH={[...diag.branches, ...diag.otherBranches].join(',')}</code> in <code>.env</code> en herstart.
            </p>
          )}
          {diag.recentCommits.length > 0 && (
            <>
              <p><strong>Laatste commits in de tijdregistratie-map (alle branches):</strong></p>
              <ul>
                {diag.recentCommits.map((c) => (
                  <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer">{c.title}</a> <span className="muted">{c.author}, {c.date.slice(0, 16).replace('T', ' ')}</span></li>
                ))}
              </ul>
            </>
          )}
          {diag.recentCommits.length === 0 && diag.entriesInRange === 0 && <p>Er zijn deze week geen tijdregistratie-commits gevonden in GitLab, op geen enkele branch.</p>}
        </div>
      )}
    </section>
  )
}

export function Tijd({ status }: { status: Status | null }) {
  const [week, setWeekState] = useState(readWeek)
  const [onlyMine, setOnlyMine] = useState(true)
  const [showWeekend, setShowWeekend] = useState(false)
  const [selected, setSelected] = useState<TimeEntry | null>(null)
  const from = ymd(week)
  const to = ymd(addDays(week, 6))
  const { data, error, loading, reload } = useLoad(() => (status?.gitlabConfigured ? api.time(from, to) : Promise.resolve([])), [from, to, status?.gitlabConfigured])

  const setWeek = (d: Date) => {
    const w = startOfWeek(d)
    setWeekState(w)
    setSelected(null)
    window.history.replaceState(null, '', `#/tijd?week=${ymd(w)}`)
  }

  const entries = (data ?? []).filter((e) => !onlyMine || e.mine)
  const hasWeekend = entries.some((e) => [5, 6].includes((parseYmd(e.date).getDay() + 6) % 7))
  const dayCount = showWeekend || hasWeekend ? 7 : 5
  const days = Array.from({ length: dayCount }, (_, i) => addDays(week, i))
  const today = ymd(new Date())

  const starts = entries.map((e) => toMinutes(e.start))
  const ends = entries.map((e) => toMinutes(e.end))
  const firstHour = Math.min(8, ...starts.map((m) => Math.floor(m / 60)))
  const lastHour = Math.max(18, ...ends.map((m) => Math.ceil(m / 60)))
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const weekTotal = entries.reduce((s, e) => s + e.durationMinutes, 0)
  const end = addDays(week, 6)
  const title = week.getMonth() === end.getMonth()
    ? `${week.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    : `${week.getDate()} ${MONTHS[week.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`

  return (
    <div className="view view-wide">
      <header className="view-head">
        <div>
          <h1>Tijd</h1>
          <p className="muted">Week {isoWeek(week)} · {title} · <strong>{duration(weekTotal)}</strong> gelogd</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Vorige week">←</button>
          <button className="btn" onClick={() => setWeek(new Date())}>Deze week</button>
          <button className="btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Volgende week">→</button>
          <button className="btn btn-ghost" onClick={reload} disabled={loading}>{loading ? 'Laden…' : '↻'}</button>
        </div>
      </header>
      <div className="filters">
        <label className="check"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Alleen mijn uren</label>
        <label className="check"><input type="checkbox" checked={showWeekend} onChange={(e) => setShowWeekend(e.target.checked)} /> Weekend tonen</label>
        <span className="muted small">Klik op een blok om de commit in GitLab te openen.</span>
      </div>

      {!status?.gitlabConfigured && <p className="panel muted">Koppel GitLab (zie README) om je gelogde uren te zien.</p>}
      {error && <p className="panel error">Uren konden niet geladen worden: {error}</p>}

      <div className="calendar-scroll">
        <div className="calendar" style={{ gridTemplateColumns: `3.2rem repeat(${dayCount}, minmax(120px, 1fr))` }}>
          <div className="cal-corner" />
          {days.map((d) => {
            const key = ymd(d)
            const total = entries.filter((e) => e.date === key).reduce((s, e) => s + e.durationMinutes, 0)
            return (
              <div key={key} className={`cal-dayhead ${key === today ? 'is-today' : ''}`}>
                <span>{DAYS_SHORT[(d.getDay() + 6) % 7]} {d.getDate()}</span>
                <span className="muted small">{total ? duration(total) : '–'}</span>
              </div>
            )
          })}
          <div className="cal-hours" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => <div key={h} className="cal-hour" style={{ height: HOUR_PX }}>{String(h).padStart(2, '0')}:00</div>)}
          </div>
          {days.map((d) => {
            const key = ymd(d)
            const dayEntries = entries.filter((e) => e.date === key)
            return (
              <div key={key} className={`cal-day ${key === today ? 'is-today' : ''}`} style={{ height: hours.length * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}>
                {dayEntries.map((e) => {
                  const top = ((toMinutes(e.start) - firstHour * 60) / 60) * HOUR_PX
                  const height = Math.max(18, (e.durationMinutes / 60) * HOUR_PX - 2)
                  // Entries that overlap are shown side by side.
                  const overlapping = dayEntries.filter((o) => toMinutes(o.start) < toMinutes(e.end) && toMinutes(o.end) > toMinutes(e.start))
                  const idx = overlapping.indexOf(e)
                  const width = 100 / overlapping.length
                  return (
                    <button
                      key={e.id}
                      className={`cal-entry ${selected?.id === e.id ? 'is-selected' : ''}`}
                      style={{ top, height, left: `calc(${idx * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                      title={`${e.start}–${e.end} · ${e.note}${e.issueIid ? ` · #${e.issueIid}` : ''}`}
                      onClick={() => (e.commit ? window.open(e.commit.url, '_blank', 'noreferrer') : setSelected(e))}
                    >
                      <span className="cal-entry-time">{e.start}–{e.end}{e.issueIid ? ` · #${e.issueIid}` : ''}{height <= 40 && e.note ? <span className="cal-entry-inline"> · {e.note}</span> : null}</span>
                      {height > 40 && <span className="cal-entry-note">{e.note}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {selected && <Detail e={selected} onClose={() => setSelected(null)} />}

      {entries.length > 0 && (
        <section className="panel">
          <h2>Alle registraties deze week</h2>
          <table className="table">
            <thead><tr><th>Dag</th><th>Tijd</th><th>Duur</th><th>Notitie</th><th>Issue</th><th>Commit</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{DAYS_SHORT[(parseYmd(e.date).getDay() + 6) % 7]} {parseYmd(e.date).getDate()}</td>
                  <td>{e.start}–{e.end}</td>
                  <td>{duration(e.durationMinutes)}</td>
                  <td>{e.note}</td>
                  <td>{e.issueIid ? <a href={e.issueUrl ?? '#'} target="_blank" rel="noreferrer">#{e.issueIid}</a> : '–'}</td>
                  <td>{e.commit ? <a className="mono" href={e.commit.url} target="_blank" rel="noreferrer">{e.commit.shortSha}</a> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {status?.gitlabConfigured && !loading && !error && entries.length === 0 && (
        <Diagnose key={from} from={from} to={to} hiddenByFilter={(data ?? []).length - entries.length} />
      )}
    </div>
  )
}
