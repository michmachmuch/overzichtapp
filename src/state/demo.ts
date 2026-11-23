import { newId } from './reducer'
import type { AppState, Story } from './types'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** A small example project so the app can be explored right away. */
export function demoState(): AppState {
  const today = new Date()
  const start = new Date(today.getTime() - 4 * 86400000)
  const end = new Date(start.getTime() + 14 * 86400000)
  const prevStart = new Date(start.getTime() - 14 * 86400000)
  const members = [
    { id: newId(), name: 'Mischa', role: 'Product owner', color: '#6366f1' },
    { id: newId(), name: 'Sam', role: 'Developer', color: '#ec4899' },
    { id: newId(), name: 'Noor', role: 'Designer', color: '#10b981' },
  ]
  const s0 = { id: newId(), name: 'Sprint 1', goal: 'Basic setup and login', startDate: iso(prevStart), endDate: iso(start), state: 'closed' as const }
  const s1 = { id: newId(), name: 'Sprint 2', goal: 'Users can manage their backlog', startDate: iso(start), endDate: iso(end), state: 'active' as const }
  const s2 = { id: newId(), name: 'Sprint 3', goal: '', startDate: iso(end), endDate: iso(new Date(end.getTime() + 14 * 86400000)), state: 'planned' as const }
  let order = 0
  const story = (title: string, points: number, sprintId: string | null, status: Story['status'], assignee: number | null, priority: Story['priority'] = 'should', doneDaysAgo?: number): Story => ({
    id: newId(),
    title,
    description: '',
    points,
    priority,
    status,
    sprintId,
    assigneeId: assignee === null ? null : members[assignee].id,
    order: ++order,
    createdAt: prevStart.toISOString(),
    doneAt: status === 'done' ? new Date(today.getTime() - (doneDaysAgo ?? 1) * 86400000).toISOString() : null,
  })
  const stories = [
    story('Set up the project repository', 2, s0.id, 'done', 1, 'must', 16),
    story('Log in with email', 5, s0.id, 'done', 1, 'must', 15),
    story('Create a story in the backlog', 3, s1.id, 'done', 1, 'must', 3),
    story('Design the board layout', 3, s1.id, 'done', 2, 'should', 2),
    story('Drag stories between columns', 5, s1.id, 'doing', 1, 'must'),
    story('Estimate stories with points', 2, s1.id, 'doing', 0, 'should'),
    story('Show a burndown chart', 5, s1.id, 'todo', null, 'could'),
    story('Invite teammates', 8, null, 'todo', null, 'should'),
    story('Export the backlog to CSV', 3, null, 'todo', null, 'could'),
    story('Dark mode', 2, null, 'todo', null, 'wont'),
  ]
  const project = {
    id: newId(),
    name: 'Example project',
    description: 'A sample project to show how the app works. Delete it whenever you like.',
    createdAt: prevStart.toISOString(),
    members,
    stories,
    sprints: [s0, s1, s2],
  }
  return { version: 1, activeProjectId: project.id, projects: [project] }
}
