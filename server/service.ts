import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import type { Config } from './config.ts'
import { enc, GitLabClient, GitLabError } from './gitlab.ts'
import type { Checkin, CheckinStatus, GitLabIssue, GitLabMergeRequest, RawTimeEntry, Status, TimeEntry } from '../shared/types.ts'

interface GLProject { id: number; name: string; web_url: string; path_with_namespace: string }
interface GLUser { id: number; username: string; name: string }
interface GLTreeItem { id: string; name: string; type: 'blob' | 'tree'; path: string }
interface GLCommit { id: string; short_id: string; title: string; web_url: string; created_at: string }
interface GLIssue {
  iid: number; title: string; web_url: string; labels: string[]; created_at: string; updated_at: string
  milestone: { title: string } | null; due_date: string | null; author: { username: string; name: string }
}
interface GLMergeRequest {
  iid: number; title: string; web_url: string; created_at: string; updated_at: string; draft?: boolean
  author: { username: string; name: string }; reviewers?: { id: number }[]
}

/** Run async work with a small concurrency limit so we don't hammer the school GitLab. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor(total / 60)
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Months (YYYY/MM) covering a date range, both ends inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}/${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
    if (out.length > 36) break
  }
  return out
}

export function parseTimeEntry(text: string): RawTimeEntry | null {
  try {
    const e = JSON.parse(text) as RawTimeEntry
    if (typeof e !== 'object' || !e || typeof e.date !== 'string' || typeof e.workTime !== 'string' || typeof e.durationMinutes !== 'number') return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !/^\d{1,2}:\d{2}$/.test(e.workTime)) return null
    return e
  } catch {
    return null
  }
}

export class Service {
  private readonly gl: GitLabClient
  private readonly config: Config
  private project: GLProject | null = null
  private user: GLUser | null = null
  /** Blob contents never change for a given blob sha, so they are cached forever. */
  private readonly blobCache = new Map<string, RawTimeEntry | null>()
  private readonly commitCache = new Map<string, GLCommit | null>()

  private readonly cacheFile: string | null
  private cacheDirty = false

  constructor(config: Config, gl: GitLabClient, cacheFile: string | null = null) {
    this.config = config
    this.gl = gl
    this.cacheFile = cacheFile
    if (cacheFile) {
      // Time entries never change once committed, so keep them across restarts.
      try {
        const saved = JSON.parse(readFileSync(cacheFile, 'utf8')) as { blobs: [string, RawTimeEntry | null][]; commits: [string, GLCommit | null][] }
        for (const [k, v] of saved.blobs) this.blobCache.set(k, v)
        for (const [k, v] of saved.commits) this.commitCache.set(k, v)
      } catch {
        /* no cache yet */
      }
    }
  }

  private async persistCache() {
    if (!this.cacheFile || !this.cacheDirty) return
    this.cacheDirty = false
    try {
      await writeFile(this.cacheFile, JSON.stringify({ blobs: [...this.blobCache], commits: [...this.commitCache] }))
    } catch {
      /* cache is optional */
    }
  }

  get configured() {
    return this.config.demo || (!!this.config.gitlabToken && !!this.config.gitlabProject)
  }

  private async ensure(): Promise<{ project: GLProject; user: GLUser }> {
    if (!this.configured) throw new GitLabError(0, 'GitLab is nog niet ingesteld (GITLAB_TOKEN en GITLAB_PROJECT in .env)')
    if (!this.project) this.project = await this.gl.get<GLProject>(`/projects/${enc(this.config.gitlabProject)}`)
    if (!this.user) this.user = await this.gl.get<GLUser>('/user')
    return { project: this.project, user: this.user }
  }

  async status(): Promise<Status> {
    const base: Status = {
      gitlabConfigured: this.configured,
      demo: this.config.demo,
      gitlabUrl: this.config.gitlabUrl,
      project: null,
      user: null,
      branch: this.config.branch,
      error: null,
    }
    if (!this.configured) return base
    try {
      const { project, user } = await this.ensure()
      return {
        ...base,
        project: { id: project.id, name: project.name, url: project.web_url },
        user: { id: this.config.timetrackingUserId ?? user.id, username: user.username, name: user.name },
      }
    } catch (e) {
      return { ...base, error: (e as Error).message }
    }
  }

  async timeEntries(from: string, to: string): Promise<TimeEntry[]> {
    const { project } = await this.ensure()
    const files: GLTreeItem[] = []
    for (const month of monthsBetween(from, to)) {
      try {
        const items = await this.gl.getAll<GLTreeItem>(`/projects/${project.id}/repository/tree`, {
          path: `${this.config.timetrackingDir}/${month}`,
          ref: this.config.branch,
          recursive: true,
        })
        files.push(...items.filter((i) => i.type === 'blob' && i.name.endsWith('.json')))
      } catch (e) {
        // A month without any entries has no folder yet.
        if (e instanceof GitLabError && e.status === 404) continue
        throw e
      }
    }

    const entries = await pool(files, 6, async (file) => {
      if (!this.blobCache.has(file.id)) {
        const text = await this.gl.getText(`/projects/${project.id}/repository/blobs/${file.id}/raw`)
        this.blobCache.set(file.id, parseTimeEntry(text))
        this.cacheDirty = true
      }
      const raw = this.blobCache.get(file.id)
      if (!raw || raw.date < from || raw.date > to) return null
      const commitKey = `${file.path}@${file.id}`
      if (!this.commitCache.has(commitKey)) {
        const commits = await this.gl.get<GLCommit[]>(`/projects/${project.id}/repository/commits`, {
          ref_name: this.config.branch,
          path: file.path,
          per_page: 1,
        })
        this.commitCache.set(commitKey, commits[0] ?? null)
        this.cacheDirty = true
      }
      const c = this.commitCache.get(commitKey) ?? null
      const entry: TimeEntry = {
        id: raw.id ?? file.id,
        date: raw.date,
        start: raw.workTime.padStart(5, '0'),
        end: addMinutes(raw.workTime, raw.durationMinutes),
        durationMinutes: raw.durationMinutes,
        note: raw.note ?? '',
        issueIid: raw.issueIid ?? null,
        issueUrl: raw.issueIid ? `${project.web_url}/-/issues/${raw.issueIid}` : null,
        processStepId: raw.processStepId ?? null,
        skillId: raw.skillId ?? null,
        userId: raw.userId,
        file: file.path,
        commit: c ? { sha: c.id, shortSha: c.short_id, url: c.web_url, title: c.title } : null,
      }
      return entry
    })
    await this.persistCache()
    return entries.filter((e): e is TimeEntry => e !== null).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  }

  async myIssues(): Promise<GitLabIssue[]> {
    const { project, user } = await this.ensure()
    const issues = await this.gl.getAll<GLIssue>(`/projects/${project.id}/issues`, {
      assignee_id: user.id,
      state: 'opened',
      order_by: 'updated_at',
    }, 3)
    return issues.map(toIssue)
  }

  async checkinStatus(c: Checkin): Promise<CheckinStatus> {
    const base: CheckinStatus = { ...c, newCount: null, newItems: [], error: null }
    if (c.kind === 'link') return base
    try {
      const { project, user } = await this.ensure()
      const since = c.lastCheckedAt ?? new Date(Date.now() - 7 * 86400000).toISOString()
      if (c.kind === 'gitlab-issues') {
        const issues = await this.gl.getAll<GLIssue>(`/projects/${project.id}/issues`, { state: 'opened', created_after: since, order_by: 'created_at' }, 2)
        return {
          ...base,
          url: c.url || `${project.web_url}/-/boards`,
          newCount: issues.length,
          newItems: issues.map((i) => ({ title: `#${i.iid} ${i.title}`, url: i.web_url, createdAt: i.created_at })),
        }
      }
      const mrs = await this.gl.getAll<GLMergeRequest>(`/projects/${project.id}/merge_requests`, { state: 'opened', updated_after: since, order_by: 'updated_at' }, 2)
      return {
        ...base,
        url: c.url || `${project.web_url}/-/merge_requests`,
        newCount: mrs.length,
        newItems: mrs.map((m) => ({
          title: `!${m.iid} ${m.title}${m.reviewers?.some((r) => r.id === user.id) ? ' (review gevraagd)' : ''}`,
          url: m.web_url,
          createdAt: m.updated_at,
        })),
      }
    } catch (e) {
      return { ...base, error: (e as Error).message }
    }
  }

  async mergeRequests(): Promise<GitLabMergeRequest[]> {
    const { project, user } = await this.ensure()
    const mrs = await this.gl.getAll<GLMergeRequest>(`/projects/${project.id}/merge_requests`, { state: 'opened' }, 2)
    return mrs.map((m) => ({
      iid: m.iid, title: m.title, url: m.web_url, createdAt: m.created_at, updatedAt: m.updated_at,
      author: m.author.name, draft: !!m.draft, reviewRequested: !!m.reviewers?.some((r) => r.id === user.id),
    }))
  }
}

function toIssue(i: GLIssue): GitLabIssue {
  return {
    iid: i.iid, title: i.title, url: i.web_url, labels: i.labels, createdAt: i.created_at, updatedAt: i.updated_at,
    milestone: i.milestone?.title ?? null, dueDate: i.due_date, author: i.author.name,
  }
}
