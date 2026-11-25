import { useState } from 'react'
import { newId } from '../api'
import type { Checkin, CheckinKind, Deadline, LocalData, Status } from '../../shared/types'
import { Modal } from '../components/Modal'

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
        <h2>Deadlines</h2>
        <p className="muted small">Uit het schoolrooster of je hoofd. Ze worden als aftelling getoond.</p>
        <form className="inline-form" onSubmit={(e) => {
          e.preventDefault()
          if (!dl.title.trim() || !dl.date) return
          save({ ...data, deadlines: [...data.deadlines, { id: newId(), ...dl, title: dl.title.trim() }] })
          setDl({ title: '', date: '', time: '' })
        }}>
          <input value={dl.title} onChange={(e) => setDl({ ...dl, title: e.target.value })} placeholder="Bijv. Sprint review" aria-label="Naam deadline" />
          <input type="date" value={dl.date} onChange={(e) => setDl({ ...dl, date: e.target.value })} aria-label="Datum" required className="w-auto" />
          <input type="time" value={dl.time} onChange={(e) => setDl({ ...dl, time: e.target.value })} aria-label="Tijd (optioneel)" className="w-auto" />
          <button className="btn btn-primary" type="submit">Toevoegen</button>
        </form>
        <ul className="settings-list">
          {deadlines.map((d) => (
            <li key={d.id}>
              <div className="grow"><strong>{d.title}</strong> <span className="muted small">{d.date}{d.time ? ` ${d.time}` : ''}</span></div>
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
