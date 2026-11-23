import { useState } from 'react'
import { useDispatch } from '../state/store'
import { sumPoints } from '../state/reducer'
import type { Project, Sprint } from '../state/types'
import { Modal } from '../components/Modal'

const iso = (d: Date) => d.toISOString().slice(0, 10)

function SprintForm({ project, sprint, onClose }: { project: Project; sprint?: Sprint; onClose: () => void }) {
  const dispatch = useDispatch()
  const last = [...project.sprints].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)
  const defStart = last ? last.endDate : iso(new Date())
  const [name, setName] = useState(sprint?.name ?? `Sprint ${project.sprints.length + 1}`)
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [startDate, setStart] = useState(sprint?.startDate ?? defStart)
  const [endDate, setEnd] = useState(sprint?.endDate ?? iso(new Date(new Date(defStart).getTime() + 14 * 86400000)))
  const invalid = endDate <= startDate

  return (
    <Modal title={sprint ? 'Edit sprint' : 'New sprint'} onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault()
        if (invalid) return
        if (sprint) dispatch({ type: 'sprint/update', sprint: { ...sprint, name, goal, startDate, endDate } })
        else dispatch({ type: 'sprint/add', sprint: { name, goal, startDate, endDate } })
        onClose()
      }}>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Sprint goal<input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What should this sprint deliver?" /></label>
        <div className="form-row">
          <label>Start<input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required /></label>
          <label>End<input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required /></label>
        </div>
        {invalid && <p className="error small">The end date must be after the start date.</p>}
        <div className="form-actions">
          {sprint && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => {
              if (confirm(`Delete ${sprint.name}? Its stories go back to the backlog.`)) { dispatch({ type: 'sprint/delete', id: sprint.id }); onClose() }
            }}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={invalid}>{sprint ? 'Save' : 'Create sprint'}</button>
        </div>
      </form>
    </Modal>
  )
}

export function Sprints({ project }: { project: Project }) {
  const dispatch = useDispatch()
  const [editing, setEditing] = useState<Sprint | 'new' | null>(null)
  const hasActive = project.sprints.some((s) => s.state === 'active')
  const order = { active: 0, planned: 1, closed: 2 }
  const sprints = [...project.sprints].sort((a, b) => order[a.state] - order[b.state] || a.startDate.localeCompare(b.startDate))

  return (
    <div className="view">
      <header className="view-head">
        <h1>Sprints</h1>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ New sprint</button>
      </header>
      {sprints.length === 0 && (
        <section className="panel empty">
          <h2>No sprints yet</h2>
          <p className="muted">A sprint is a fixed period (often 1 to 4 weeks) in which you finish a set of stories.</p>
        </section>
      )}
      {sprints.map((s) => {
        const stories = project.stories.filter((st) => st.sprintId === s.id)
        const done = stories.filter((st) => st.status === 'done')
        return (
          <section key={s.id} className={`panel sprint sprint-${s.state}`}>
            <div className="panel-head">
              <div>
                <h2>{s.name} <span className={`badge badge-${s.state}`}>{s.state}</span></h2>
                <p className="muted small">{s.startDate} → {s.endDate}{s.goal ? ` · ${s.goal}` : ''}</p>
              </div>
              <div className="head-actions">
                {s.state === 'planned' && (
                  <button className="btn" disabled={hasActive} title={hasActive ? 'Complete the active sprint first' : ''}
                    onClick={() => dispatch({ type: 'sprint/start', id: s.id })}>Start sprint</button>
                )}
                {s.state === 'active' && (
                  <button className="btn" onClick={() => {
                    const open = stories.length - done.length
                    if (confirm(open ? `Complete ${s.name}? ${open} unfinished stories go back to the backlog.` : `Complete ${s.name}?`))
                      dispatch({ type: 'sprint/complete', id: s.id })
                  }}>Complete sprint</button>
                )}
                {s.state !== 'closed' && <button className="btn btn-ghost" onClick={() => setEditing(s)}>Edit</button>}
              </div>
            </div>
            <p className="small">{stories.length} stories · {sumPoints(done)} / {sumPoints(stories)} points done</p>
          </section>
        )
      })}
      {editing && <SprintForm project={project} sprint={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
