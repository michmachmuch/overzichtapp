import { describe, expect, it } from 'vitest'
import { burndown, emptyState, reducer, activeProject } from './reducer'
import type { AppState } from './types'

function setup(): AppState {
  let s = reducer(emptyState, { type: 'project/add', name: 'Test', description: '' })
  s = reducer(s, { type: 'sprint/add', sprint: { name: 'S1', goal: '', startDate: '2026-01-01', endDate: '2026-01-11' } })
  s = reducer(s, { type: 'story/add', story: { title: 'A', description: '', points: 3, priority: 'must' } })
  s = reducer(s, { type: 'story/add', story: { title: 'B', description: '', points: 5, priority: 'should' } })
  return s
}

describe('reducer', () => {
  it('creates and selects a project', () => {
    const s = setup()
    expect(s.projects).toHaveLength(1)
    expect(activeProject(s)?.name).toBe('Test')
  })

  it('allows only one active sprint', () => {
    let s = setup()
    s = reducer(s, { type: 'sprint/add', sprint: { name: 'S2', goal: '', startDate: '2026-01-11', endDate: '2026-01-21' } })
    const [s1, s2] = activeProject(s)!.sprints
    s = reducer(s, { type: 'sprint/start', id: s1.id })
    s = reducer(s, { type: 'sprint/start', id: s2.id })
    expect(activeProject(s)!.sprints.map((x) => x.state)).toEqual(['active', 'planned'])
  })

  it('returns unfinished stories to the backlog when a sprint completes', () => {
    let s = setup()
    const p = activeProject(s)!
    const sprint = p.sprints[0]
    const [a, b] = p.stories
    s = reducer(s, { type: 'story/assignSprint', id: a.id, sprintId: sprint.id })
    s = reducer(s, { type: 'story/assignSprint', id: b.id, sprintId: sprint.id })
    s = reducer(s, { type: 'sprint/start', id: sprint.id })
    s = reducer(s, { type: 'story/move', id: a.id, status: 'done' })
    s = reducer(s, { type: 'sprint/complete', id: sprint.id })
    const stories = activeProject(s)!.stories
    expect(stories.find((x) => x.id === a.id)!.sprintId).toBe(sprint.id)
    expect(stories.find((x) => x.id === b.id)!.sprintId).toBeNull()
    expect(stories.find((x) => x.id === a.id)!.doneAt).not.toBeNull()
  })

  it('reorders stories within a list', () => {
    let s = setup()
    const [a, b] = activeProject(s)!.stories
    s = reducer(s, { type: 'story/reorder', id: b.id, direction: -1 })
    const sorted = [...activeProject(s)!.stories].sort((x, y) => x.order - y.order)
    expect(sorted.map((x) => x.id)).toEqual([b.id, a.id])
  })

  it('unassigns stories when a member is removed', () => {
    let s = setup()
    s = reducer(s, { type: 'member/add', name: 'Sam', role: 'Dev' })
    const p = activeProject(s)!
    const story = p.stories[0]
    s = reducer(s, { type: 'story/update', story: { ...story, assigneeId: p.members[0].id } })
    s = reducer(s, { type: 'member/delete', id: p.members[0].id })
    expect(activeProject(s)!.stories[0].assigneeId).toBeNull()
  })

  it('computes a burndown', () => {
    const s = setup()
    const p = activeProject(s)!
    const sprint = p.sprints[0]
    const stories = p.stories.map((st, i) => ({ ...st, sprintId: sprint.id, status: i === 0 ? ('done' as const) : st.status, doneAt: i === 0 ? '2026-01-03T12:00:00Z' : null }))
    const { total, points } = burndown(sprint, stories, new Date('2026-01-05T12:00:00'))
    expect(total).toBe(8)
    expect(points).toHaveLength(11)
    expect(points[0].ideal).toBe(8)
    expect(points[10].ideal).toBe(0)
    expect(points[1].actual).toBe(8)
    expect(points[3].actual).toBe(5)
    expect(points[8].actual).toBeNull()
  })
})
