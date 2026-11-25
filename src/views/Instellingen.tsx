import { useState } from 'react'
import { newId } from '../api'
import type { Checkin, CheckinKind, Deadline, LocalData, Status } from '../../shared/types'
import { Modal } from '../components/Modal'
import { TimeSelect } from '../components/TimeSelect'
import { DateInput } from '../components/DateInput'
import { dmy } from '../format'

const KIND_LABELS: Record<CheckinKind, string> = {
  link: 'Link (bijv. WhatsApp, Teams, e-mail)',
  'gitlab-issues': 'GitLab: nieuwe issues',
  'gitlab-merge-requests': 'GitLab: merge requests',
}

function CheckinForm({ checkin, onSave, onClose }: { checkin?: Checkin; onSave: (c: Checkin) => void; onClose: () => void }) {
  const [title, setTitle] = useState(checkin?.title ?? '')
  const [kind, setKind] = useState<CheckinKind>(checkin?.kind ?? 'link')
  const [url, setUrl] = useState(checkin?.url ?? '')
  const [info, setInfo] = useState(checkin?.info ?? '')
  return (
    <Modal title={checkin ? 'Check-in bewerken' : 'Nieuwe check-in'} onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        onSave({ id: checkin?.id ?? newId(), title: title.trim(), kind, url: url.trim(), info: info.trim(), lastCheckedAt: checkin?.lastCheckedAt ?? null })
        onClose()
      }}>
        <label>Naam<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Teams-kanaal van de docent" required /></label>
        <label>Soort
          <select value={kind} onChange={(e) => setKind(e.target.value as CheckinKind)}>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Link
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === 'link' ? 'https://…' : 'Leeg laten voor de standaardpagina in GitLab'} />
        </label>
        <label>Waar let je op?
          <textarea rows={3} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Wat moet je hier checken en wat kun je daarna doen?" />
        </label>
        {kind !== 'link' && <p className="muted small">Bij GitLab-check-ins telt de app automatisch wat er nieuw is sinds je laatst op "Gecheckt" klikte.</p>}
        <div className="form-actions"><span className="spacer" /><button type="button" className="btn" onClick={onClose}>Annuleren</button><button className="btn btn-primary" type="submit">Opslaan</button></div>
      </form>
    </Modal>
  )
}

export function Instellingen({ status, data, save }: { status: Status | null; data: LocalData; save: (d: LocalData) => void }) {
  const [editing, setEditing] = useState<Checkin | 'new' | null>(null)
  const [dl, setDl] = useState<Omit<Deadline, 'id'>>({ title: '', date: '', time: '' })

  const saveCheckin = (c: Checkin) => {
    const exists = data.checkins.some((x) => x.id === c.id)
    save({ ...data, checkins: exists ? data.checkins.map((x) => (x.id === c.id ? c : x)) : [...data.checkins, c] })
  }
  const move = (i: number, dir: -1 | 1) => {
    const list = [...data.checkins]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    save({ ...data, checkins: list })
  }
  const [sp, setSp] = useState({ name: '', start: '', startTime: '', end: '', endTime: '' })
  const sprintInvalid = !!sp.start && !!sp.end && `${sp.end}T${sp.endTime || '24:00'}` <= `${sp.start}T${sp.startTime || '00:00'}`
  const sprints = [...data.sprints].sort((a, b) => a.start.localeCompare(b.start))
  const deadlines = [...data.deadlines].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  return (
    <div className="view">
      <header className="view-head"><h1>Instellingen</h1></header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Check-ins</h2>
            <p className="muted small">Dingen die je regelmatig moet nakijken. Ze staan op "Wat nu?".</p>
          </div>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Check-in</button>
        </div>
        <ul className="settings-list">
          {data.checkins.map((c, i) => (
            <li key={c.id}>
              <span className="reorder">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Omhoog">▲</button>
                <button className="icon-btn" disabled={i === data.checkins.length - 1} onClick={() => move(i, 1)} aria-label="Omlaag">▼</button>
              </span>
              <div className="grow">
                <strong>{c.title}</strong>
                <div className="muted small">{KIND_LABELS[c.kind]}</div>
              </div>
              <button className="btn btn-ghost small" onClick={() => setEditing(c)}>Bewerken</button>
              <button className="icon-btn" aria-label={`Verwijder ${c.title}`} onClick={() => confirm(`"${c.title}" verwijderen?`) && save({ ...data, checkins: data.checkins.filter((x) => x.id !== c.id) })}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Sprints</h2>
        <p className="muted small">Van wanneer tot wanneer een sprint loopt. Op "Wat nu?" zie je hoeveel uur je in de huidige sprint hebt gelogd.</p>
        <form className="inline-form" onSubmit={(e) => {
          e.preventDefault()
          if (!sp.start || !sp.end || sprintInvalid) return
          const name = sp.name.trim() || `Sprint ${data.sprints.length + 1}`
          save({ ...data, sprints: [...data.sprints, { id: newId(), name, start: sp.start, startTime: sp.startTime, end: sp.end, endTime: sp.endTime }] })
          setSp({ name: '', start: '', startTime: '', end: '', endTime: '' })
        }}>
          <input value={sp.name} onChange={(e) => setSp({ ...sp, name: e.target.value })} placeholder={`Sprint ${data.sprints.length + 1}`} aria-label="Naam sprint" />
          <span className="muted small">van</span>
          <DateInput value={sp.start} onChange={(start) => setSp({ ...sp, start })} label="Startdatum sprint" />
          <TimeSelect value={sp.startTime} onChange={(startTime) => setSp({ ...sp, startTime })} label="Starttijd sprint (optioneel)" />
          <span className="muted small">t/m</span>
          <DateInput value={sp.end} onChange={(end) => setSp({ ...sp, end })} label="Einddatum sprint" />
          <TimeSelect value={sp.endTime} onChange={(endTime) => setSp({ ...sp, endTime })} label="Eindtijd sprint (optioneel)" />
          <button className="btn btn-primary" type="submit" disabled={!sp.start || !sp.end || sprintInvalid}>Toevoegen</button>
        </form>
        {sprintInvalid && <p className="error small">Het einde ligt voor het begin van de sprint.</p>}
        <p className="muted small">Tijd leeg laten = vanaf het begin van de eerste dag t/m het eind van de laatste dag.</p>
        <ul className="settings-list">
          {sprints.map((x) => (
            <li key={x.id}>
              <div className="grow"><strong>{x.name}</strong> <span className="muted small">{dmy(x.start)}{x.startTime ? ` ${x.startTime}` : ''} t/m {dmy(x.end)}{x.endTime ? ` ${x.endTime}` : ''}</span></div>
              <button className="icon-btn" aria-label={`Verwijder ${x.name}`} onClick={() => confirm(`"${x.name}" verwijderen?`) && save({ ...data, sprints: data.sprints.filter((y) => y.id !== x.id) })}>✕</button>
            </li>
          ))}
        </ul>
        <label className="target-hours">
          Uren per sprint
          <input
            type="number"
            min={1}
            max={500}
            value={data.sprintHoursTarget}
            onChange={(e) => { const n = Number(e.target.value); if (n > 0) save({ ...data, sprintHoursTarget: n }) }}
            aria-label="Uren per sprint"
          />
        </label>
      </section>

      <section className="panel">
        <h2>Deadlines</h2>
        <p className="muted small">Uit het schoolrooster of je hoofd. Ze worden als aftelling getoond.</p>
        <form className="inline-form" onSubmit={(e) => {
          e.preventDefault()
          if (!dl.title.trim() || !dl.date) return
          save({ ...data, deadlines: [...data.deadlines, { id: newId(), ...dl, title: dl.title.trim() }] })
          setDl({ title: '', date: '', time: '' })
        }}>
          <input value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} placeholder="Bijv. Sprint review" aria-label="Naam deadline" />
          <DateInput value={dl.date} onChange={(date) => setDl({ ...dl, date })} label="Datum" />
          <TimeSelect value={dl.time} onChange={(time) => setDl({ ...dl, time })} label="Tijd (optioneel)" />
          <button className="btn btn-primary" type="submit">Toevoegen</button>
        </form>
        <ul className="settings-list">
          {deadlines.map((d) => (
            <li key={d.id}>
              <div className="grow"><strong>{d.title}</strong> <span className="muted small">{dmy(d.date)}{d.time ? ` ${d.time}` : ''}</span></div>
              <button className="icon-btn" aria-label={`Verwijder ${d.title}`} onClick={() => save({ ...data, deadlines: data.deadlines.filter((x) => x.id !== d.id) })}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>GitLab-koppeling</h2>
        {status?.demo && <p className="warn small">Demo-modus: je ziet voorbeelddata, er wordt niets van GitLab gelezen.</p>}
        {!status?.gitlabConfigured ? (
          <p className="muted small">Niet ingesteld. Zet <code>GITLAB_TOKEN</code> en <code>GITLAB_PROJECT</code> in het bestand <code>.env</code> en herstart de container.</p>
        ) : status.error ? (
          <p className="error small">{status.error}</p>
        ) : (
          <dl>
            <dt>Project</dt><dd>{status.project ? <a href={status.project.url} target="_blank" rel="noreferrer">{status.project.name}</a> : '–'}</dd>
            <dt>Ingelogd als</dt><dd>{status.user ? `${status.user.name} (@${status.user.username})` : '–'}</dd>
            <dt>Branch uren</dt><dd>{status.branch}</dd>
          </dl>
        )}
        <p className="muted small">De app leest alleen uit GitLab en schrijft er nooit iets naartoe.</p>
      </section>

      {editing && <CheckinForm checkin={editing === 'new' ? undefined : editing} onSave={saveCheckin} onClose={() => setEditing(null)} />}
    </div>
  )
}
