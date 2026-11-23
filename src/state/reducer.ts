import type { AppState, Id, Member, Project, Sprint, Story, StoryStatus } from './types'

export const MEMBER_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16']

export function newId(): Id {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export const emptyState: AppState = { version: 1, activeProjectId: null, projects: [] }

export type Action =
  | { type: 'project/add'; name: string; description: string }
  | { type: 'project/update'; id: Id; name: string; description: string }
  | { type: 'project/delete'; id: Id }
  | { type: 'project/select'; id: Id }
  | { type: 'member/add'; name: string; role: string }
  | { type: 'member/update'; member: Member }
  | { type: 'member/delete'; id: Id }
  | { type: 'story/add'; story: Pick<Story, 'title' | 'description' | 'points' | 'priority'> & Partial<Pick<Story, 'sprintId' | 'assigneeId'>> }
  | { type: 'story/update'; story: Story }
  | { type: 'story/delete'; id: Id }
  | { type: 'story/move'; id: Id; status: StoryStatus }
  | { type: 'story/assignSprint'; id: Id; sprintId: Id | null }
  | { type: 'story/reorder'; id: Id; direction: -1 | 1 }
  | { type: 'sprint/add'; sprint: Pick<Sprint, 'name' | 'goal' | 'startDate' | 'endDate'> }
  | { type: 'sprint/update'; sprint: Sprint }
  | { type: 'sprint/delete'; id: Id }
  | { type: 'sprint/start'; id: Id }
  | { type: 'sprint/complete'; id: Id }
  | { type: 'state/replace'; state: AppState }

function updateActive(state: AppState, fn: (p: Project) => Project): AppState {
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === state.activeProjectId ? fn(p) : p)),
  }
}

export function reducer(state: AppState, action: Action): AppState {
  const now = new Date().toISOString()
  switch (action.type) {
    case 'state/replace':
      return action.state

    case 'project/add': {
      const project: Project = {
        id: newId(),
        name: action.name.trim() || 'Untitled project',
        description: action.description,
        createdAt: now,
        members: [],
        stories: [],
        sprints: [],
      }
      return { ...state, projects: [...state.projects, project], activeProjectId: project.id }
    }
    case 'project/update':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, name: action.name.trim() || p.name, description: action.description } : p,
        ),
      }
    case 'project/delete': {
      const projects = state.projects.filter((p) => p.id !== action.id)
      const activeProjectId = state.activeProjectId === action.id ? (projects[0]?.id ?? null) : state.activeProjectId
      return { ...state, projects, activeProjectId }
    }
    case 'project/select':
      return { ...state, activeProjectId: action.id }

    case 'member/add':
      return updateActive(state, (p) => ({
        ...p,
        members: [
          ...p.members,
          { id: newId(), name: action.name.trim(), role: action.role.trim(), color: MEMBER_COLORS[p.members.length % MEMBER_COLORS.length] },
        ],
      }))
    case 'member/update':
      return updateActive(state, (p) => ({ ...p, members: p.members.map((m) => (m.id === action.member.id ? action.member : m)) }))
    case 'member/delete':
      return updateActive(state, (p) => ({
        ...p,
        members: p.members.filter((m) => m.id !== action.id),
        stories: p.stories.map((s) => (s.assigneeId === action.id ? { ...s, assigneeId: null } : s)),
      }))

    case 'story/add':
      return updateActive(state, (p) => {
        const maxOrder = p.stories.reduce((m, s) => Math.max(m, s.order), 0)
        const story: Story = {
          id: newId(),
          title: action.story.title.trim() || 'Untitled story',
          description: action.story.description,
          points: action.story.points,
          priority: action.story.priority,
          status: 'todo',
          sprintId: action.story.sprintId ?? null,
          assigneeId: action.story.assigneeId ?? null,
          order: maxOrder + 1,
          createdAt: now,
          doneAt: null,
        }
        return { ...p, stories: [...p.stories, story] }
      })
    case 'story/update':
      return updateActive(state, (p) => ({
        ...p,
        stories: p.stories.map((s) => {
          if (s.id !== action.story.id) return s
          const next = action.story
          return { ...next, doneAt: next.status === 'done' ? (s.doneAt ?? now) : null }
        }),
      }))
    case 'story/delete':
      return updateActive(state, (p) => ({ ...p, stories: p.stories.filter((s) => s.id !== action.id) }))
    case 'story/move':
      return updateActive(state, (p) => ({
        ...p,
        stories: p.stories.map((s) =>
          s.id === action.id
            ? { ...s, status: action.status, doneAt: action.status === 'done' ? (s.doneAt ?? now) : null }
            : s,
        ),
      }))
    case 'story/assignSprint':
      return updateActive(state, (p) => ({
        ...p,
        stories: p.stories.map((s) => (s.id === action.id ? { ...s, sprintId: action.sprintId } : s)),
      }))
    case 'story/reorder':
      return updateActive(state, (p) => {
        const target = p.stories.find((s) => s.id === action.id)
        if (!target) return p
        // Reorder within the same list (same sprint, or backlog).
        const siblings = p.stories.filter((s) => s.sprintId === target.sprintId).sort((a, b) => a.order - b.order)
        const idx = siblings.findIndex((s) => s.id === action.id)
        const swapWith = siblings[idx + action.direction]
        if (!swapWith) return p
        return {
          ...p,
          stories: p.stories.map((s) => {
            if (s.id === target.id) return { ...s, order: swapWith.order }
            if (s.id === swapWith.id) return { ...s, order: target.order }
            return s
          }),
        }
      })

    case 'sprint/add':
      return updateActive(state, (p) => ({
        ...p,
        sprints: [...p.sprints, { id: newId(), ...action.sprint, name: action.sprint.name.trim() || `Sprint ${p.sprints.length + 1}`, state: 'planned' }],
      }))
    case 'sprint/update':
      return updateActive(state, (p) => ({ ...p, sprints: p.sprints.map((s) => (s.id === action.sprint.id ? action.sprint : s)) }))
    case 'sprint/delete':
      return updateActive(state, (p) => ({
        ...p,
        sprints: p.sprints.filter((s) => s.id !== action.id),
        stories: p.stories.map((s) => (s.sprintId === action.id ? { ...s, sprintId: null } : s)),
      }))
    case 'sprint/start':
      // Only one active sprint at a time.
      return updateActive(state, (p) => {
        if (p.sprints.some((s) => s.state === 'active' && s.id !== action.id)) return p
        return { ...p, sprints: p.sprints.map((s) => (s.id === action.id ? { ...s, state: 'active' } : s)) }
      })
    case 'sprint/complete':
      // Unfinished stories go back to the backlog.
      return updateActive(state, (p) => ({
        ...p,
        sprints: p.sprints.map((s) => (s.id === action.id ? { ...s, state: 'closed' } : s)),
        stories: p.stories.map((s) => (s.sprintId === action.id && s.status !== 'done' ? { ...s, sprintId: null } : s)),
      }))
  }
}

export function activeProject(state: AppState): Project | null {
  return state.projects.find((p) => p.id === state.activeProjectId) ?? null
}

export function sumPoints(stories: Story[]): number {
  return stories.reduce((sum, s) => sum + (s.points ?? 0), 0)
}

/** Ideal vs. actual remaining points per day of a sprint, for a burndown chart. */
export function burndown(sprint: Sprint, stories: Story[], today = new Date()) {
  const inSprint = stories.filter((s) => s.sprintId === sprint.id)
  const total = sumPoints(inSprint)
  const start = new Date(sprint.startDate + 'T00:00:00')
  const end = new Date(sprint.endDate + 'T00:00:00')
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
  const points: { day: number; date: string; ideal: number; actual: number | null }[] = []
  for (let d = 0; d <= days; d++) {
    const date = new Date(start.getTime() + d * 86400000)
    const endOfDay = new Date(date.getTime() + 86400000)
    const doneBy = inSprint.filter((s) => s.doneAt && new Date(s.doneAt) < endOfDay)
    points.push({
      day: d,
      date: date.toISOString().slice(0, 10),
      ideal: Math.round((total - (total * d) / days) * 10) / 10,
      actual: date <= today ? total - sumPoints(doneBy) : null,
    })
  }
  return { total, points }
}
