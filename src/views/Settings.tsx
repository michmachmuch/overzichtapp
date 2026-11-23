import { useRef, useState } from 'react'
import { useAppState, useDispatch, isValidState } from '../state/store'
import type { Project } from '../state/types'

export function Settings({ project }: { project: Project }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `overzicht-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (!isValidState(data)) throw new Error('bad file')
      if (confirm('Replace all current data with this backup?')) {
        dispatch({ type: 'state/replace', state: data })
        setMsg('Backup restored.')
      }
    } catch {
      setMsg('That file is not a valid backup.')
    }
  }

  return (
    <div className="view">
      <header className="view-head"><h1>Settings</h1></header>
      <section className="panel">
        <h2>Project</h2>
        <form className="form" onSubmit={(e) => { e.preventDefault(); dispatch({ type: 'project/update', id: project.id, name, description }); setMsg('Project saved.') }}>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Description<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <div className="form-actions">
            <button type="button" className="btn btn-danger-ghost" onClick={() => confirm(`Delete project "${project.name}" and everything in it?`) && dispatch({ type: 'project/delete', id: project.id })}>Delete project</button>
            <span className="spacer" />
            <button className="btn btn-primary" type="submit">Save</button>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Backup</h2>
        <p className="muted small">Your data is saved in this browser only. Download a backup to keep it safe or move it to another device.</p>
        <div className="head-actions">
          <button className="btn" onClick={exportData}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore backup…</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }} />
        </div>
      </section>
      {msg && <p className="toast" role="status">{msg}</p>}
    </div>
  )
}
