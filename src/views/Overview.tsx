import { burndown, sumPoints } from '../state/reducer'
import { STATUS_LABELS, type Project, type StoryStatus } from '../state/types'
import { BurndownChart, VelocityChart } from '../components/Charts'
import { Avatar } from '../components/Avatar'

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

export function Overview({ project, go }: { project: Project; go: (route: string) => void }) {
  const active = project.sprints.find((s) => s.state === 'active')
  const sprintStories = active ? project.stories.filter((s) => s.sprintId === active.id) : []
  const backlog = project.stories.filter((s) => s.sprintId === null && s.status !== 'done')
  const total = sumPoints(sprintStories)
  const done = sumPoints(sprintStories.filter((s) => s.status === 'done'))
  const pct = total ? Math.round((done / total) * 100) : 0
  const daysLeft = active ? daysBetween(new Date(), new Date(active.endDate + 'T23:59:59')) : 0
  const closed = project.sprints.filter((s) => s.state === 'closed')
  const velocity = closed.map((s) => ({
    name: s.name,
    points: sumPoints(project.stories.filter((st) => st.sprintId === s.id && st.status === 'done')),
  }))
  const avgVelocity = velocity.length ? Math.round(velocity.reduce((a, v) => a + v.points, 0) / velocity.length) : null
  const counts = (['todo', 'doing', 'done'] as StoryStatus[]).map((st) => ({ st, n: sprintStories.filter((s) => s.status === st).length }))
  const unestimated = backlog.filter((s) => s.points === null).length

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>{project.name}</h1>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Sprint progress</div>
          <div className="stat-value">{active ? `${pct}%` : '—'}</div>
          <div className="muted small">{active ? `${done} of ${total} points done` : 'No active sprint'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Days left</div>
          <div className="stat-value">{active ? Math.max(0, daysLeft) : '—'}</div>
          <div className="muted small">{active ? `Ends ${active.endDate}` : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Backlog</div>
          <div className="stat-value">{backlog.length}</div>
          <div className="muted small">{sumPoints(backlog)} points{unestimated ? `, ${unestimated} not estimated` : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Average velocity</div>
          <div className="stat-value">{avgVelocity ?? '—'}</div>
          <div className="muted small">{avgVelocity !== null ? `points per sprint (${velocity.length} ${velocity.length === 1 ? "sprint" : "sprints"})` : 'Complete a sprint first'}</div>
        </div>
      </div>

      {active ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{active.name}</h2>
              {active.goal && <p className="muted">Goal: {active.goal}</p>}
            </div>
            <button className="btn" onClick={() => go('board')}>Open board</button>
          </div>
          <div className="progress" aria-label={`${pct}% done`}><div style={{ width: `${pct}%` }} /></div>
          <div className="status-row">
            {counts.map(({ st, n }) => (
              <span key={st} className={`status-pill status-${st}`}>{STATUS_LABELS[st]}: <strong>{n}</strong></span>
            ))}
          </div>
          <h3>Burndown</h3>
          <BurndownChart {...burndown(active, project.stories)} />
        </section>
      ) : (
        <section className="panel empty">
          <h2>No sprint running</h2>
          <p className="muted">Plan a sprint, add stories from the backlog and start it to see progress here.</p>
          <button className="btn btn-primary" onClick={() => go('sprints')}>Plan a sprint</button>
        </section>
      )}

      <div className="two-col">
        {velocity.length > 0 && (
          <section className="panel">
            <h2>Velocity</h2>
            <p className="muted small">Story points completed per finished sprint.</p>
            <VelocityChart data={velocity} />
          </section>
        )}
        {active && project.members.length > 0 && (
          <section className="panel">
            <h2>Workload this sprint</h2>
            <ul className="workload">
              {project.members.map((m) => {
                const mine = sprintStories.filter((s) => s.assigneeId === m.id)
                const open = sumPoints(mine.filter((s) => s.status !== 'done'))
                const finished = sumPoints(mine.filter((s) => s.status === 'done'))
                return (
                  <li key={m.id}>
                    <Avatar member={m} />
                    <span className="grow">{m.name}</span>
                    <span className="muted small">{open} open · {finished} done</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
