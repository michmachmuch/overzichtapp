import { useCallback, useEffect, useState } from 'react'
import { api, useLoad } from './api'
import type { LocalData } from '../shared/types'
import { WatNu } from './views/WatNu'
import { Tijd } from './views/Tijd'
import { Instellingen } from './views/Instellingen'

const ROUTES = [
  { id: 'wat-nu', label: 'Wat nu?', icon: '➜' },
  { id: 'tijd', label: 'Tijd', icon: '◷' },
  { id: 'instellingen', label: 'Instellingen', icon: '⚙' },
] as const
type Route = (typeof ROUTES)[number]['id']

function readRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Route
  return ROUTES.some((r) => r.id === h) ? h : 'wat-nu'
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const status = useLoad(() => api.status())
  const local = useLoad(() => api.data())
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const { setData } = local
  const save = useCallback((d: LocalData) => {
    setData(d)
    api.saveData(d).then(() => setSaveError(null)).catch((e: Error) => setSaveError(`Opslaan mislukt: ${e.message}`))
  }, [setData])

  return (
    <div className="layout">
      <header className="topnav">
        <div className="brand"><span className="logo">◎</span> Overzicht</div>
        <nav>
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={route === r.id ? 'active' : ''}>
              <span className="nav-icon">{r.icon}</span>{r.label}
            </a>
          ))}
        </nav>
        {status.data?.demo && <span className="demo-pill">demo</span>}
      </header>
      <main>
        {saveError && <p className="banner error">{saveError}</p>}
        {local.error && <p className="banner error">Kan de server niet bereiken: {local.error}</p>}
        {status.data?.error && route !== 'instellingen' && <p className="banner error">GitLab: {status.data.error}</p>}
        {local.data && route === 'wat-nu' && <WatNu status={status.data} data={local.data} save={save} setData={setData} />}
        {local.data && route === 'tijd' && <Tijd status={status.data} sprints={local.data.sprints} sprintHoursTarget={local.data.sprintHoursTarget} />}
        {local.data && route === 'instellingen' && <Instellingen status={status.data} data={local.data} save={save} />}
      </main>
    </div>
  )
}
