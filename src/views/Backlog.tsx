import { useState } from 'react'
import { useDispatch } from '../state/store'
import { sumPoints } from '../state/reducer'
import { STATUS_LABELS, type Priority, type Project, type Story } from '../state/types'
import { StoryForm } from '../components/StoryForm'
import { Avatar } from '../components/Avatar'
import { Points, PriorityTag } from '../components/StoryCard'

export function Backlog({ project }: { project: Project }) {
  const dispatch = useDispatch()
  const [editing, setEditing] = useState<Story | 'new' | null>(null)
  const [newIn, setNewIn] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [prio, setPrio] = useState<Priority | ''>('')
  const [showDone, setShowDone] = useState(false)

  const openSprints = project.sprints.filter((s) => s.state !== 'closed')
  const matches = (s: Story) =>
    (!query || s.title.toLowerCase().includes(query.toLowerCase())) && (!prio || s.priority === prio)
  const list = (sprintId: string | null) =>
    project.stories
      .filter((s) => s.sprintId === sprintId && matches(s) && (showDone || s.status !== 'done' || sprintId !== null))
      .sort((a, b) => a.order - b.order)

  const sections = [
    ...openSprints.map((s) => ({ id: s.id as string | null, title: s.name + (s.state === 'active' ? ' · active' : ''), sub: s.goal })),
    { id: null, title: 'Product backlog', sub: 'Everything not planned in a sprint yet' },
  ]

  const memberOf = (id: string | null) => project.members.find((m) => m.id === id)

  return (
    <div className="view">
      <header className="view-head">
        <h1>Backlog</h1>
        <button className="btn btn-primary" onClick={() => { setNewIn(null); setEditing('new') }}>+ New story</button>
      </header>
      <div className="filters">
        <input type="search" placeholder="Search stories" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={prio} onChange={(e) => setPrio(e.target.value as Priority | '')}>
          <option value="">All priorities</option>
          <option value="must">Must have</option>
          <option value="should">Should have</option>
          <option value="could">Could have</option>
          <option value="wont">Won't have</option>
        </select>
        <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done</label>
      </div>

      {sections.map((sec) => {
        const items = list(sec.id)
        return (
          <section key={sec.id ?? 'backlog'} className="panel"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/story-id')
              if (id) dispatch({ type: 'story/assignSprint', id, sprintId: sec.id })
            }}>
            <div className="panel-head">
              <div>
                <h2>{sec.title}</h2>
                {sec.sub && <p className="muted small">{sec.sub}</p>}
              </div>
              <span className="muted small">{items.length} stories · {sumPoints(items)} pts</span>
            </div>
            {items.length === 0 ? (
              <p className="muted small drop-hint">No stories here. Drag a story here or add one.</p>
            ) : (
              <ul className="story-list">
                {items.map((s, i) => (
                  <li key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/story-id', s.id)} className={s.status === 'done' ? 'is-done' : ''}>
                    <span className="reorder">
                      <button className="icon-btn" disabled={i === 0} onClick={() => dispatch({ type: 'story/reorder', id: s.id, direction: -1 })} aria-label="Move up">▲</button>
                      <button className="icon-btn" disabled={i === items.length - 1} onClick={() => dispatch({ type: 'story/reorder', id: s.id, direction: 1 })} aria-label="Move down">▼</button>
                    </span>
                    <button className="story-row-title" onClick={() => setEditing(s)}>{s.title}</button>
                    <span className={`status-pill status-${s.status}`}>{STATUS_LABELS[s.status]}</span>
                    <PriorityTag priority={s.priority} />
                    <Points points={s.points} />
                    <Avatar member={memberOf(s.assigneeId)} size={22} />
                    <select className="sprint-select" value={s.sprintId ?? ''} aria-label="Move to sprint"
                      onChange={(e) => dispatch({ type: 'story/assignSprint', id: s.id, sprintId: e.target.value || null })}>
                      <option value="">Backlog</option>
                      {openSprints.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn btn-ghost small" onClick={() => { setNewIn(sec.id); setEditing('new') }}>+ Add story</button>
          </section>
        )
      })}

      {editing && (
        <StoryForm project={project} story={editing === 'new' ? undefined : editing} defaultSprintId={newIn} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
