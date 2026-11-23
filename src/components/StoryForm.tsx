import { useState } from 'react'
import { useDispatch } from '../state/store'
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Project, type Story, type StoryStatus } from '../state/types'
import { Modal } from './Modal'

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21]

interface Props {
  project: Project
  story?: Story
  defaultSprintId?: string | null
  onClose: () => void
}

export function StoryForm({ project, story, defaultSprintId = null, onClose }: Props) {
  const dispatch = useDispatch()
  const [title, setTitle] = useState(story?.title ?? '')
  const [description, setDescription] = useState(story?.description ?? '')
  const [points, setPoints] = useState<number | null>(story?.points ?? null)
  const [priority, setPriority] = useState<Priority>(story?.priority ?? 'should')
  const [status, setStatus] = useState<StoryStatus>(story?.status ?? 'todo')
  const [sprintId, setSprintId] = useState<string | null>(story?.sprintId ?? defaultSprintId)
  const [assigneeId, setAssigneeId] = useState<string | null>(story?.assigneeId ?? null)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (story) {
      dispatch({ type: 'story/update', story: { ...story, title: title.trim(), description, points, priority, status, sprintId, assigneeId } })
    } else {
      dispatch({ type: 'story/add', story: { title, description, points, priority, sprintId, assigneeId } })
    }
    onClose()
  }

  const remove = () => {
    if (story && confirm(`Delete "${story.title}"?`)) {
      dispatch({ type: 'story/delete', id: story.id })
      onClose()
    }
  }

  const openSprints = project.sprints.filter((s) => s.state !== 'closed' || s.id === story?.sprintId)

  return (
    <Modal title={story ? 'Edit story' : 'New story'} onClose={onClose}>
      <form onSubmit={save} className="form">
        <label>
          Title
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="As a user I want to…" required />
        </label>
        <label>
          Description
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details, acceptance criteria…" />
        </label>
        <div className="form-row">
          <label>
            Story points
            <select value={points ?? ''} onChange={(e) => setPoints(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Not estimated</option>
              {POINT_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Sprint
            <select value={sprintId ?? ''} onChange={(e) => setSprintId(e.target.value || null)}>
              <option value="">Backlog (no sprint)</option>
              {openSprints.map((s) => <option key={s.id} value={s.id}>{s.name}{s.state === 'active' ? ' (active)' : ''}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select value={assigneeId ?? ''} onChange={(e) => setAssigneeId(e.target.value || null)}>
              <option value="">Unassigned</option>
              {project.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>
        {story && (
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as StoryStatus)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
        <div className="form-actions">
          {story && <button type="button" className="btn btn-danger-ghost" onClick={remove}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{story ? 'Save' : 'Add story'}</button>
        </div>
      </form>
    </Modal>
  )
}
