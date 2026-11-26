import { useState } from 'react'
import { api, useLoad } from '../api'
import { addDays, dmy, DAYS_SHORT, duration, isoWeek, MONTHS, parseYmd, startOfWeek, toMinutes, ymd } from '../format'
import type { Sprint, Status, TimeDiagnosis, TimeEntry } from '../../shared/types'
import { entryInSprint, sprintEnd, sprintStart, stamp } from '../sprint'
import { useNarrow } from '../useNarrow'

const HOUR_PX = 72
/** Heights in px used to decide how many lines of the note fit in a calendar block. */
const TIME_LINE_PX = 17
const NOTE_LINE_PX = 15
const ENTRY_PAD_PX = 6

const timeRange = (e: TimeEntry) => (e.start ? `${e.start}–${e.end}` : 'zonder tijd')

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
        <dt>Wanneer</dt><dd>{dmy(e.date)}, {e.start ? `${e.start}–${e.end}` : 'zonder starttijd'} ({duration(e.durationMinutes)})</dd>
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
        <p className="warn small">Er zijn {hiddenByFilter} registraties die niet als "van jou" herkend worden. Kies "Iedereen" bij "Uren van" om ze te zien.</p>
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
                  <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer">{c.title}</a> <span className="muted">{c.author}, {dmy(c.date)} {c.date.slice(11, 16)}</span></li>
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

/** Person filter: 'me' (default), a GitLab user id, 'u<userId>' for an unknown tijdregistratie id, or 'all'. */
function readPerson(): string {
  return window.location.hash.match(/persoon=([\w-]+)/)?.[1] ?? 'me'
}

/** Categorical colours in a fixed order; people past the eighth fold into grey. */
const PERSON_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)']

const personKey = (e: TimeEntry) => (e.personId !== null ? String(e.personId) : `u${e.userId}`)

export function Tijd({ status, sprints, sprintHoursTarget }: { status: Status | null; sprints: Sprint[]; sprintHoursTarget: number }) {
  const [week, setWeekState] = useState(readWeek)
  const [person, setPersonState] = useState(readPerson)
  const members = useLoad(() => (status?.gitlabConfigured ? api.members() : Promise.resolve([])), [status?.gitlabConfigured])
  const [showWeekend, setShowWeekend] = useState(false)
  const [selected, setSelected] = useState<TimeEntry | null>(null)
  const narrow = useNarrow()
  // On a phone the calendar shows one day at a time; null = today (or Monday when today is in another week).
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const from = ymd(week)
  const to = ymd(addDays(week, 6))
  const { data, error, loading, reload } = useLoad(() => (status?.gitlabConfigured ? api.time(from, to) : Promise.resolve([])), [from, to, status?.gitlabConfigured])
  // Totals are counted over the sprint this week belongs to (the running one if several overlap).
  const now = stamp()
  const overlapping = sprints.filter((s) => s.start <= to && s.end >= from)
  const sprint = overlapping.find((s) => sprintStart(s) <= now && now < sprintEnd(s)) ?? [...overlapping].sort((a, b) => b.start.localeCompare(a.start))[0] ?? null
  const sprintData = useLoad(
    () => (sprint && status?.gitlabConfigured ? api.time(sprint.start, sprint.end) : Promise.resolve(null)),
    [sprint?.start, sprint?.end, status?.gitlabConfigured],
  )

  const writeHash = (w: Date, p: string) =>
    window.history.replaceState(null, '', `#/tijd?week=${ymd(w)}${p !== 'me' ? `&persoon=${p}` : ''}`)
  const setWeek = (d: Date) => {
    const w = startOfWeek(d)
    setWeekState(w)
    setSelected(null)
    setPickedDay(null)
    writeHash(w, person)
  }
  const setPerson = (p: string) => {
    setPersonState(p)
    setSelected(null)
    writeHash(week, p)
  }

  const all = data ?? []
  // Entries without a start time count too, unless they are on a day where the sprint starts or ends at a set time.
  const inSprint = (e: TimeEntry) => !!sprint && entryInSprint(e, sprint)
  // Entries the totals are based on: the whole sprint, or this week when no sprint is set.
  const totalsBase = sprint ? (sprintData.data ?? []).filter(inSprint) : all
  const me = members.data?.find((m) => m.isMe)
  const meKeyOf = () => (me ? String(me.id) : null)
  // Everyone to pick from: team members from GitLab plus anyone else found in the entries.
  const people: { key: string; label: string }[] = (members.data ?? []).map((m) => ({ key: String(m.id), label: m.isMe ? `${m.name} (ik)` : m.name }))
  for (const e of [...all, ...totalsBase]) {
    const k = personKey(e)
    if (!people.some((p) => p.key === k)) people.push({ key: k, label: e.personName ?? `Onbekend (userId ${e.userId})` })
  }
  // Only offer people who logged time (in this sprint, or this week without a sprint). You and the current choice always stay.
  const pickerPeople = people.filter((p) => totalsBase.some((e) => personKey(e) === p.key) || all.some((e) => personKey(e) === p.key) || p.key === meKeyOf() || p.key === person)
  const isShown = (e: TimeEntry, key: string) => (key === 'all' ? true : key === 'me' ? e.mine : personKey(e) === key)
  const minutesOf = (key: string) => totalsBase.filter((e) => isShown(e, key === meKeyOf() ? 'me' : key)).reduce((s, e) => s + e.durationMinutes, 0)
  const meKey = me ? String(me.id) : null
  const selectedKey = person === 'me' ? meKey : person
  const entries = all.filter((e) => (person === 'all' ? true : person === 'me' ? e.mine : personKey(e) === person))
  const colorOf = (e: TimeEntry) => {
    if (person !== 'all') return 'var(--series-1)'
    const i = people.findIndex((p) => p.key === personKey(e))
    return i >= 0 && i < PERSON_COLORS.length ? PERSON_COLORS[i] : 'var(--muted)'
  }
  const shownName = person === 'all' ? 'het hele team' : person === 'me' ? 'jou' : people.find((p) => p.key === person)?.label ?? 'deze persoon'
  const hasWeekend = entries.some((e) => [5, 6].includes((parseYmd(e.date).getDay() + 6) % 7))
  const dayCount = showWeekend || hasWeekend ? 7 : 5
  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(week, i))
  const today = ymd(new Date())
  const activeDay = pickedDay && weekDays.some((d) => ymd(d) === pickedDay)
    ? pickedDay
    : weekDays.some((d) => ymd(d) === today) ? today : ymd(week)
  const days = narrow ? weekDays.filter((d) => ymd(d) === activeDay) : weekDays
  const dayTotal = (key: string) => entries.filter((e) => e.date === key).reduce((s, e) => s + e.durationMinutes, 0)

  const timed = entries.filter((e) => e.start && e.end)
  const untimed = entries.filter((e) => !e.start && days.some((d) => ymd(d) === e.date))
  const starts = timed.map((e) => toMinutes(e.start!))
  const ends = timed.map((e) => toMinutes(e.end!))
  const firstHour = Math.min(8, ...starts.map((m) => Math.floor(m / 60)))
  const lastHour = Math.max(18, ...ends.map((m) => Math.ceil(m / 60)))
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const total = minutesOf(person)
  const end = addDays(week, 6)
  const title = week.getMonth() === end.getMonth()
    ? `${week.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    : `${week.getDate()} ${MONTHS[week.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`

  return (
    <div className="view view-wide">
      <header className="view-head">
        <div>
          <h1>Tijd</h1>
          <p className="muted">Week {isoWeek(week)} · {title}</p>
          <p className="muted">
            {sprint ? <>{sprint.name}: </> : <>Deze week: </>}
            <strong>{sprint && sprintData.loading ? '…' : duration(total)}</strong>
            {sprint && person !== 'all' && <> van {sprintHoursTarget} uur</>} gelogd door {shownName}
            {!sprint && <> · <a href="#/instellingen">stel sprints in</a> om per sprint te tellen</>}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setWeek(addDays(week, -7))} aria-label="Vorige week">←</button>
          <button className="btn" onClick={() => setWeek(new Date())}>Deze week</button>
          <button className="btn" onClick={() => setWeek(addDays(week, 7))} aria-label="Volgende week">→</button>
          <button className="btn btn-ghost" onClick={reload} disabled={loading}>{loading ? 'Laden…' : '↻'}</button>
        </div>
      </header>
      <div className="filters">
        <label className="person-picker">
          <span className="muted small">Uren van</span>
          <select value={selectedKey && person === 'me' ? selectedKey : person} onChange={(e) => setPerson(e.target.value === meKey ? 'me' : e.target.value)} aria-label="Teamlid">
            {pickerPeople.map((p) => <option key={p.key} value={p.key}>{p.label} · {duration(minutesOf(p.key))}</option>)}
            {pickerPeople.length === 0 && <option value="me">Ik</option>}
            <option value="all">Iedereen · {duration(minutesOf('all'))}</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={showWeekend} onChange={(e) => setShowWeekend(e.target.checked)} /> Weekend tonen</label>
        <span className="muted small">{narrow ? 'Tik' : 'Klik'} op een blok om de commit in GitLab te openen.</span>
      </div>

      {!status?.gitlabConfigured && <p className="panel muted">Koppel GitLab (zie README) om je gelogde uren te zien.</p>}
      {error && <p className="panel error">Uren konden niet geladen worden: {error}</p>}

      {person === 'all' && entries.length > 0 && (
        <div className="legend" aria-label="Legenda">
          {people.filter((p) => entries.some((e) => personKey(e) === p.key)).map((p) => {
            const i = people.indexOf(p)
            return <span key={p.key}><i className="swatch" style={{ background: i < PERSON_COLORS.length ? PERSON_COLORS[i] : 'var(--muted)' }} />{p.label}</span>
          })}
        </div>
      )}
      {narrow && (
        <div className="day-tabs" role="tablist" aria-label="Dag">
          {weekDays.map((d) => {
            const key = ymd(d)
            const t = dayTotal(key)
            return (
              <button key={key} role="tab" aria-selected={key === activeDay} className={`day-tab ${key === activeDay ? 'active' : ''} ${key === today ? 'is-today' : ''}`} onClick={() => setPickedDay(key)}>
                <span className="day-tab-name">{DAYS_SHORT[(d.getDay() + 6) % 7]}</span>
                <span className="day-tab-date">{d.getDate()}</span>
                <span className="day-tab-total">{t ? duration(t) : '–'}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="calendar-scroll">
        <div className={`calendar ${narrow ? 'calendar-day' : ''}`} style={{ gridTemplateColumns: `3.2rem repeat(${days.length}, minmax(${narrow ? 0 : 120}px, 1fr))` }}>
          <div className="cal-corner" />
          {days.map((d) => {
            const key = ymd(d)
            const total = dayTotal(key)
            return (
              <div key={key} className={`cal-dayhead ${key === today ? 'is-today' : ''}`}>
                <span>{DAYS_SHORT[(d.getDay() + 6) % 7]} {d.getDate()}</span>
                <span className="muted small">{total ? duration(total) : '–'}</span>
              </div>
            )
          })}
          {untimed.length > 0 && (
            <>
              <div className="cal-untimed-label">zonder tijd</div>
              {days.map((d) => {
                const key = ymd(d)
                return (
                  <div key={key} className="cal-untimed">
                    {untimed.filter((e) => e.date === key).map((e) => (
                      <button
                        key={e.id}
                        className="cal-chip"
                        style={{ ['--entry-color' as string]: colorOf(e) }}
                        title={`${person === 'all' && e.personName ? `${e.personName} · ` : ''}${duration(e.durationMinutes)} zonder starttijd · ${e.note}${e.issueIid ? ` · #${e.issueIid}` : ''}`}
                        onClick={() => (e.commit ? window.open(e.commit.url, '_blank', 'noreferrer') : setSelected(e))}
                      >
                        <span className="cal-entry-time">{person === 'all' && <span className="cal-entry-who">{(e.personName ?? '?').split(' ')[0]} · </span>}{duration(e.durationMinutes)}{e.issueIid ? ` · #${e.issueIid}` : ''}</span>
                        {e.note && <span className="cal-entry-inline">{e.note}</span>}
                      </button>
                    ))}
                  </div>
                )
              })}
            </>
          )}
          <div className="cal-hours" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => <div key={h} className="cal-hour" style={{ height: HOUR_PX }}>{String(h).padStart(2, '0')}:00</div>)}
          </div>
          {days.map((d) => {
            const key = ymd(d)
            const dayEntries = timed.filter((e) => e.date === key)
            return (
              <div key={key} className={`cal-day ${key === today ? 'is-today' : ''}`} style={{ height: hours.length * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}>
                {dayEntries.map((e) => {
                  const top = ((toMinutes(e.start!) - firstHour * 60) / 60) * HOUR_PX
                  const height = Math.max(20, (e.durationMinutes / 60) * HOUR_PX - 2)
                  // The time line always shows; the note gets only the lines that fit below it.
                  const noteLines = Math.floor((height - ENTRY_PAD_PX - TIME_LINE_PX) / NOTE_LINE_PX)
                  // Entries that overlap are shown side by side.
                  const overlapping = dayEntries.filter((o) => toMinutes(o.start!) < toMinutes(e.end!) && toMinutes(o.end!) > toMinutes(e.start!))
                  const idx = overlapping.indexOf(e)
                  const width = 100 / overlapping.length
                  return (
                    <button
                      key={e.id}
                      className={`cal-entry ${selected?.id === e.id ? 'is-selected' : ''}`}
                      style={{ top, height, left: `calc(${idx * width}% + 2px)`, width: `calc(${width}% - 4px)`, ['--entry-color' as string]: colorOf(e) }}
                      title={`${person === 'all' && e.personName ? `${e.personName} · ` : ''}${e.start}–${e.end} · ${e.note}${e.issueIid ? ` · #${e.issueIid}` : ''}`}
                      onClick={() => (e.commit ? window.open(e.commit.url, '_blank', 'noreferrer') : setSelected(e))}
                    >
                      <span className="cal-entry-line">
                        <span className="cal-entry-time">{person === 'all' && <span className="cal-entry-who">{(e.personName ?? '?').split(' ')[0]} · </span>}{e.start}–{e.end}{e.issueIid ? ` · #${e.issueIid}` : ''}</span>
                        {noteLines < 1 && e.note && <span className="cal-entry-inline">· {e.note}</span>}
                      </span>
                      {noteLines >= 1 && e.note && <span className="cal-entry-note" style={{ WebkitLineClamp: noteLines, maxHeight: noteLines * NOTE_LINE_PX }}>{e.note}</span>}
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
          {narrow ? (
            <ul className="entry-list">
              {entries.map((e) => (
                <li key={e.id}>
                  <div className="entry-list-head">
                    <strong>{DAYS_SHORT[(parseYmd(e.date).getDay() + 6) % 7]} {parseYmd(e.date).getDate()}</strong>
                    <span>{timeRange(e)}</span>
                    <span className="muted">{duration(e.durationMinutes)}</span>
                  </div>
                  {person === 'all' && <div className="small muted">{e.personName ?? `userId ${e.userId}`}</div>}
                  {e.note && <div>{e.note}</div>}
                  {(e.issueIid || e.commit) && (
                    <div className="entry-list-links small">
                      {e.issueIid && <a href={e.issueUrl ?? '#'} target="_blank" rel="noreferrer">Issue #{e.issueIid}</a>}
                      {e.commit && <a className="mono" href={e.commit.url} target="_blank" rel="noreferrer">Commit {e.commit.shortSha} ↗</a>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
          <table className="table">
            <thead><tr><th>Dag</th>{person === 'all' && <th>Wie</th>}<th>Tijd</th><th>Duur</th><th>Notitie</th><th>Issue</th><th>Commit</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{DAYS_SHORT[(parseYmd(e.date).getDay() + 6) % 7]} {parseYmd(e.date).getDate()}</td>
                  {person === 'all' && <td>{e.personName ?? `userId ${e.userId}`}</td>}
                  <td>{e.start ? timeRange(e) : <span className="muted">{timeRange(e)}</span>}</td>
                  <td>{duration(e.durationMinutes)}</td>
                  <td>{e.note}</td>
                  <td>{e.issueIid ? <a href={e.issueUrl ?? '#'} target="_blank" rel="noreferrer">#{e.issueIid}</a> : '–'}</td>
                  <td>{e.commit ? <a className="mono" href={e.commit.url} target="_blank" rel="noreferrer">{e.commit.shortSha}</a> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </section>
      )}
      {status?.gitlabConfigured && !loading && !error && entries.length === 0 && (
        <Diagnose key={from} from={from} to={to} hiddenByFilter={person === 'me' ? all.length - entries.length : 0} />
      )}
    </div>
  )
}
