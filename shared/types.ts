/** Types shared between the server and the web app. */

/** One entry as written by the tijdregistratie program (one JSON file in .time-tracking/YYYY/MM). */
export interface RawTimeEntry {
  schemaVersion: number
  id: string
  createdAt: string
  userId: number
  projectId: number
  issueIid?: number | null
  branch?: string
  catalogVersion?: string
  processId?: string
  processStepId?: string
  skillId?: string
  /** YYYY-MM-DD, local date */
  date: string
  durationMinutes: number
  /** HH:MM, local start time (may be missing or empty when no start time was entered) */
  workTime?: string | null
  note?: string
}

export interface TimeEntry {
  id: string
  date: string
  /** HH:MM, or null when the entry has no start time */
  start: string | null
  /** HH:MM, or null when the entry has no start time */
  end: string | null
  durationMinutes: number
  note: string
  issueIid: number | null
  issueUrl: string | null
  processStepId: string | null
  skillId: string | null
  userId: number
  /** Whether this entry is yours (by tijdregistratie userId or by commit author). */
  mine: boolean
  /** GitLab user id of the team member this entry belongs to, if known. */
  personId: number | null
  personName: string | null
  file: string
  commit: { sha: string; shortSha: string; url: string; title: string } | null
}

export interface GitLabIssue {
  iid: number
  title: string
  url: string
  labels: string[]
  createdAt: string
  updatedAt: string
  milestone: string | null
  dueDate: string | null
  author: string
}

export interface GitLabMergeRequest {
  iid: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  author: string
  draft: boolean
  /** True when you are asked to review it. */
  reviewRequested: boolean
}

export type CheckinKind = 'link' | 'gitlab-issues' | 'gitlab-merge-requests'

export interface Checkin {
  id: string
  title: string
  kind: CheckinKind
  url: string
  /** What to look for when checking this. */
  info: string
  lastCheckedAt: string | null
}

export interface Deadline {
  id: string
  title: string
  /** YYYY-MM-DD */
  date: string
  /** Optional HH:MM */
  time: string
}

export interface Todo {
  id: string
  title: string
  note: string
  done: boolean
  createdAt: string
  doneAt: string | null
}

export interface Sprint {
  id: string
  name: string
  /** YYYY-MM-DD, first day of the sprint */
  start: string
  /** Optional HH:MM the sprint starts on its first day ('' = start of the day) */
  startTime?: string
  /** YYYY-MM-DD, last day of the sprint (inclusive) */
  end: string
  /** Optional HH:MM the sprint ends on its last day ('' = end of the day) */
  endTime?: string
}

export interface LocalData {
  version: 1
  checkins: Checkin[]
  deadlines: Deadline[]
  todos: Todo[]
  sprints: Sprint[]
  /** Hours you have to log per sprint. */
  sprintHoursTarget: number
}

/** A check-in plus what is new since you last checked it. */
export interface CheckinStatus extends Checkin {
  newCount: number | null
  newItems: { title: string; url: string; createdAt: string }[]
  error: string | null
}

export interface Status {
  gitlabConfigured: boolean
  demo: boolean
  gitlabUrl: string
  project: { id: number; name: string; url: string } | null
  user: { id: number; username: string; name: string } | null
  branch: string
  error: string | null
}

export interface TimeDiagnosis {
  branches: string[]
  folders: { branch: string; path: string; files: number; error: string | null }[]
  entriesInRange: number
  mine: number
  userIds: Record<string, number>
  gitlabUserId: number
  configuredUserId: number | null
  /** Branches (other than the configured ones) with recent time-tracking commits. */
  otherBranches: string[]
  recentCommits: { title: string; url: string; author: string; date: string }[]
}

export interface TeamMember {
  id: number
  username: string
  name: string
  isMe: boolean
}
