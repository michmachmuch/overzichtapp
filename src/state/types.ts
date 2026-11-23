export type Id = string

export type StoryStatus = 'todo' | 'doing' | 'done'
export type Priority = 'must' | 'should' | 'could' | 'wont'
export type SprintState = 'planned' | 'active' | 'closed'

export interface Member {
  id: Id
  name: string
  role: string
  color: string
}

export interface Story {
  id: Id
  title: string
  description: string
  points: number | null
  priority: Priority
  status: StoryStatus
  sprintId: Id | null
  assigneeId: Id | null
  /** Lower number = higher in the backlog. */
  order: number
  createdAt: string
  doneAt: string | null
}

export interface Sprint {
  id: Id
  name: string
  goal: string
  startDate: string
  endDate: string
  state: SprintState
}

export interface Project {
  id: Id
  name: string
  description: string
  createdAt: string
  members: Member[]
  stories: Story[]
  sprints: Sprint[]
}

export interface AppState {
  version: 1
  activeProjectId: Id | null
  projects: Project[]
}

export const STATUS_LABELS: Record<StoryStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  must: 'Must have',
  should: 'Should have',
  could: 'Could have',
  wont: "Won't have",
}
