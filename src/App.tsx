import { useEffect, useState } from 'react'
import { StoreProvider, useAppState, useDispatch } from './state/store'
import { activeProject } from './state/reducer'
import { demoState } from './state/demo'
import { Modal } from './components/Modal'
import { Overview } from './views/Overview'
import { Backlog } from './views/Backlog'
import { Board } from './views/Board'
import { Sprints } from './views/Sprints'
import { Team } from './views/Team'
import { Settings } from './views/Settings'

const ROUTES = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'board', label: 'Board', icon: '▦' },
  { id: 'backlog', label: 'Backlog', icon: '☰' },
  { id: 'sprints', label: 'Sprints', icon: '⟳' },
  { id: 'team', label: 'Team', icon: '☺' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
] as const
type Route = (typeof ROUTES)[number]['id']

function useHashRoute(): [Route, (r: string) => void] {
  const read = () => {
    const h = window.location.hash.replace('#/', '') as Route
    return ROUTES.some((r) => r.id === h) ? h : 'overview'
  }
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onHash = () => setRoute(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [route, (r) => { window.location.hash = `/${r}` }]
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  return (
    <Modal title="New project" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; dispatch({ type: 'project/add', name, description }); onClose() }}>
        <label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Description<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you building?" /></label>
        <div className="form-actions"><span className="spacer" /><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit">Create</button></div>
      </form>
    </Modal>
  )
}

function Welcome({ onNew }: { onNew: () => void }) {
  const dispatch = useDispatch()
  return (
    <div className="welcome">
      <div className="logo-big">◎</div>
      <h1>Overzicht</h1>
      <p className="muted">Keep track of your project: backlog, sprints, a board and your progress, all in one place.</p>
      <div className="head-actions center">
        <button className="btn btn-primary" onClick={onNew}>Create your first project</button>
        <button className="btn" onClick={() => dispatch({ type: 'state/replace', state: demoState() })}>Explore an example</button>
      </div>
      <p className="muted small">Everything is stored in this browser. Nothing is sent anywhere.</p>
    </div>
  )
}

function Shell() {
  const state = useAppState()
  const dispatch = useDispatch()
  const project = activeProject(state)
  const [route, go] = useHashRoute()
  const [newProject, setNewProject] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!project) {
    return (
      <>
        <Welcome onNew={() => setNewProject(true)} />
        {newProject && <NewProjectModal onClose={() => setNewProject(false)} />}
      </>
    )
  }

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><span className="logo">◎</span> Overzicht</div>
        <label className="project-switch">
          <span className="muted small">Project</span>
          <select value={project.id} onChange={(e) => e.target.value === '__new' ? setNewProject(true) : dispatch({ type: 'project/select', id: e.target.value })}>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ New project…</option>
          </select>
        </label>
        <nav>
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={route === r.id ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">{r.icon}</span>{r.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">☰</button>
          <strong>{project.name}</strong>
        </div>
        {route === 'overview' && <Overview project={project} go={go} />}
        {route === 'board' && <Board project={project} go={go} />}
        {route === 'backlog' && <Backlog project={project} />}
        {route === 'sprints' && <Sprints project={project} />}
        {route === 'team' && <Team project={project} />}
        {route === 'settings' && <Settings key={project.id} project={project} />}
      </div>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      {newProject && <NewProjectModal onClose={() => setNewProject(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
