import { useState } from 'react'
import { useDispatch } from '../state/store'
import { sumPoints } from '../state/reducer'
import { STATUS_LABELS, type Project, type Story, type StoryStatus } from '../state/types'
import { StoryCard } from '../components/StoryCard'
import { StoryForm } from '../components/StoryForm'

const COLUMNS: StoryStatus[] = ['todo', 'doing', 'done']

export function Board({ project, go }: { project: Project; go: (route: string) => void }) {
  const dispatch = useDispatch()
  const [editing, setEditing] = useState<Story | 'new' | null>(null)
  const [over, setOver] = useState<StoryStatus | null>(null)
  const [who, setWho] = useState('')
  const active = project.sprints.find((s) => s.state === 'active')

  if (!active) {
    return (
      <div className="view">
        <header className="view-head"><h1>Board</h1></header>
        <section className="panel empty">
          <h2>No active sprint</h2>
          <p className="muted">The board shows the stories of the running sprint. Start a sprint first.</p>
          <button className="btn btn-primary" onClick={() => go('sprints')}>Go to sprints</button>
        </section>
      </div>
    )
  }

  const stories = project.stories
    .filter((s) => s.sprintId === active.id && (!who || s.assigneeId === who || (who === 'none' && !s.assigneeId)))
    .sort((a, b) => a.order - b.order)

  return (
    <div className="view view-wide">
      <header className="view-head">
        <div>
          <h1>{active.name}</h1>
          {active.goal && <p className="muted">Goal: {active.goal}</p>}
        </div>
        <div className="head-actions">
          {project.members.length > 0 && (
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by person">
              <option value="">Everyone</option>
              {project.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value="none">Unassigned</option>
            </select>
          )}
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ New story</button>
        </div>
      </header>
      <div className="board">
        {COLUMNS.map((col) => {
          const items = stories.filter((s) => s.status === col)
          return (
            <div key={col}
              className={`column ${over === col ? 'is-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(col) }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null)
                const id = e.dataTransfer.getData('text/story-id')
                if (id) dispatch({ type: 'story/move', id, status: col })
              }}>
              <div className="column-head">
                <span className={`dot status-${col}`} />
                <strong>{STATUS_LABELS[col]}</strong>
                <span className="muted small">{items.length} · {sumPoints(items)} pts</span>
              </div>
              <div className="column-body">
                {items.map((s) => (
                  <StoryCard key={s.id} story={s} draggable member={project.members.find((m) => m.id === s.assigneeId)} onOpen={() => setEditing(s)} />
                ))}
                {items.length === 0 && <p className="muted small drop-hint">Drop stories here</p>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="muted small hint">Tip: drag cards between columns, or tap a card to change its status.</p>
      {editing && <StoryForm project={project} story={editing === 'new' ? undefined : editing} defaultSprintId={active.id} onClose={() => setEditing(null)} />}
    </div>
  )
}
