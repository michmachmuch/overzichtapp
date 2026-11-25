/** Types shared between the server and the web app. */

/** One entry as written by the tijdregistratie program (one JSON file in .timetracking/YYYY/MM). */
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
  /** HH:MM, local start time */
  workTime: string
  note?: string
}

export interface TimeEntry {
  id: string
  date: string
  start: string
  end: string
  durationMinutes: number
  note: string
  issueIid: number | null
  issueUrl: string | null
  processStepId: string | null
  skillId: string | null
  userId: number
  /** Whether this entry is yours (by tijdregistratie userId or by commit author). */
  mine: boolean
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

export interface LocalData {
  version: 1
  checkins: Checkin[]
  deadlines: Deadline[]
  todos: Todo[]
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
