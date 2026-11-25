/**
 * Fake GitLab responses for DEMO=1, so the app can be tried without a token.
 * Also used by the tests.
 */
import type { FetchLike } from './gitlab.ts'

const PROJECT = { id: 7023, name: 'Volleypool project', web_url: 'https://gitlab.example/demo/volleypool', path_with_namespace: 'demo/volleypool' }
const USER = { id: 3761, username: 'mischa', name: 'Mischa' }

function iso(d: Date) { return d.toISOString().slice(0, 10) }

function demoEntries() {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const notes = [
    ['09:00', 60, 'Daily stand-up en sprintbord bijwerken', 71],
    ['10:30', 90, 'Inlogscherm bouwen', 64],
    ['13:00', 45, 'Code review merge request van teamgenoot', 66],
    ['14:00', 120, 'Unit tests schrijven voor teamindeling', 64],
    ['16:00', 30, 'Brainstormen en verfijnen voorstellen nieuwe functies en epic', 71],
  ] as const
  const out: { path: string; sha: string; content: object }[] = []
  for (let d = -7; d < 5; d++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + d)
    if (day > today || day.getDay() === 0 || day.getDay() === 6) continue
    const pick = notes.filter((_, i) => (i + d + 10) % 3 !== 0)
    pick.forEach(([time, mins, note, issue], i) => {
      const date = iso(day)
      const id = `demo-${date}-${i}`
      out.push({
        path: `.timetracking/${date.slice(0, 4)}/${date.slice(5, 7)}/${id}.json`,
        sha: `blob${date.replace(/-/g, '')}${i}`,
        content: {
          schemaVersion: 1, id, createdAt: `${date}T${time}:00.000Z`, userId: USER.id, projectId: PROJECT.id,
          issueIid: issue, branch: 'develop', processId: 'scrum-proces', processStepId: 'scrum-proces-plannen-sprint',
          skillId: 'scrum-proces-vaardigheid-kiezen-user-stories', date, durationMinutes: mins, workTime: time, note,
        },
      })
    })
  }
  return out
}

function hoursAgo(h: number) { return new Date(Date.now() - h * 3600000).toISOString() }

const ISSUES = [
  { iid: 64, title: 'Als speler wil ik kunnen inloggen', labels: ['To Do', 'Sprint 3'], created_at: hoursAgo(240), updated_at: hoursAgo(5), milestone: { title: 'Sprint 3' }, due_date: null, assignee: true },
  { iid: 71, title: 'Nieuwe epic: teamindeling', labels: ['Doing'], created_at: hoursAgo(30), updated_at: hoursAgo(2), milestone: { title: 'Sprint 3' }, due_date: null, assignee: true },
  { iid: 75, title: 'Bug: score wordt niet opgeslagen', labels: ['Bug'], created_at: hoursAgo(3), updated_at: hoursAgo(3), milestone: null, due_date: null, assignee: false },
  { iid: 76, title: 'Wireframes voor uitslagenpagina', labels: ['Design'], created_at: hoursAgo(1), updated_at: hoursAgo(1), milestone: null, due_date: null, assignee: false },
]

const MRS = [
  { iid: 12, title: 'Teamindeling: algoritme voor eerlijke teams', created_at: hoursAgo(20), updated_at: hoursAgo(4), draft: false, reviewers: [{ id: USER.id }] },
  { iid: 13, title: 'Draft: uitslagenpagina', created_at: hoursAgo(6), updated_at: hoursAgo(6), draft: true, reviewers: [] },
]

function respond(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Promise.resolve({
    ok: status < 400,
    status,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  })
}

export function demoFetch(): FetchLike {
  const entries = demoEntries()
  return (url, init) => {
    if (init.method !== 'GET') throw new Error('Only GET is allowed')
    const u = new URL(url)
    const p = u.pathname.replace(/^\/api\/v4/, '')
    const q = u.searchParams
    if (p === '/user') return respond(USER)
    if (/^\/projects\/[^/]+$/.test(p)) return respond(PROJECT)
    if (p.endsWith('/repository/tree')) {
      const dir = q.get('path') ?? ''
      const items = entries.filter((e) => e.path.startsWith(dir + '/'))
      if (!items.length) return respond({ message: '404 Tree Not Found' }, 404)
      return respond(items.map((e) => ({ id: e.sha, name: e.path.split('/').pop(), type: 'blob', path: e.path })))
    }
    const blob = p.match(/\/repository\/blobs\/([^/]+)\/raw$/)
    if (blob) {
      const e = entries.find((x) => x.sha === blob[1])
      return e ? respond(JSON.stringify(e.content)) : respond({}, 404)
    }
    if (p.endsWith('/repository/commits')) {
      const e = entries.find((x) => x.path === q.get('path'))
      const sha = (e?.sha ?? 'x').replace('blob', '').padEnd(40, 'a')
      return respond([{ id: sha, short_id: sha.slice(0, 8), title: 'Tijdregistratie', author_name: 'Mischa', author_email: 'mischa@example.com', web_url: `${PROJECT.web_url}/-/commit/${sha}`, created_at: hoursAgo(1) }])
    }
    if (/\/repository\/commits\/[^/]+\/refs$/.test(p)) return respond([{ type: 'branch', name: 'develop' }])
    if (p.endsWith('/issues')) {
      let list = ISSUES
      if (q.get('assignee_id')) list = list.filter((i) => i.assignee)
      const after = q.get('created_after')
      if (after) list = list.filter((i) => i.created_at > after)
      return respond(list.map((i) => ({ ...i, web_url: `${PROJECT.web_url}/-/issues/${i.iid}`, author: { username: 'teamgenoot', name: 'Teamgenoot' } })))
    }
    if (p.endsWith('/merge_requests')) {
      const after = q.get('updated_after')
      const list = after ? MRS.filter((m) => m.updated_at > after) : MRS
      return respond(list.map((m) => ({ ...m, web_url: `${PROJECT.web_url}/-/merge_requests/${m.iid}`, author: { username: 'teamgenoot', name: 'Teamgenoot' } })))
    }
    return respond({ message: 'not found' }, 404)
  }
}
