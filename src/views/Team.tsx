import { useState } from 'react'
import { useDispatch } from '../state/store'
import type { Project } from '../state/types'
import { Avatar } from '../components/Avatar'

export function Team({ project }: { project: Project }) {
  const dispatch = useDispatch()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Team</h1>
          <p className="muted">People you can assign stories to. Working alone? Add just yourself, or skip this.</p>
        </div>
      </header>
      <section className="panel">
        <form className="inline-form" onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          dispatch({ type: 'member/add', name, role })
          setName(''); setRole('')
        }}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Role (e.g. Developer)" value={role} onChange={(e) => setRole(e.target.value)} />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
        {project.members.length === 0 ? (
          <p className="muted small">No team members yet.</p>
        ) : (
          <ul className="member-list">
            {project.members.map((m) => {
              const open = project.stories.filter((s) => s.assigneeId === m.id && s.status !== 'done').length
              return (
                <li key={m.id}>
                  <Avatar member={m} size={32} />
                  <div className="grow">
                    <input className="bare" value={m.name} aria-label="Name" onChange={(e) => dispatch({ type: 'member/update', member: { ...m, name: e.target.value } })} />
                    <input className="bare muted small" value={m.role} placeholder="Role" aria-label="Role" onChange={(e) => dispatch({ type: 'member/update', member: { ...m, role: e.target.value } })} />
                  </div>
                  <span className="muted small">{open} open stories</span>
                  <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => confirm(`Remove ${m.name}? Their stories become unassigned.`) && dispatch({ type: 'member/delete', id: m.id })}>✕</button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
