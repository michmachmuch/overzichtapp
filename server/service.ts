import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import type { Config } from './config.ts'
import { enc, GitLabClient, GitLabError } from './gitlab.ts'
import type { Checkin, CheckinStatus, GitLabIssue, GitLabMergeRequest, RawTimeEntry, Status, TeamMember, TimeDiagnosis, TimeEntry } from '../shared/types.ts'

interface GLProject { id: number; name: string; web_url: string; path_with_namespace: string }
interface GLUser { id: number; username: string; name: string; email?: string; public_email?: string; commit_email?: string }
interface GLMember { id: number; username: string; name: string; state?: string; bot?: boolean }
interface GLTreeItem { id: string; name: string; type: 'blob' | 'tree'; path: string }
interface GLCommit { id: string; short_id: string; title: string; web_url: string; created_at: string; author_name?: string; author_email?: string }
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

function isEntry(e: unknown): e is RawTimeEntry {
  const x = e as RawTimeEntry
  return !!x && typeof x === 'object' && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date)
    && typeof x.durationMinutes === 'number'
}

/** Whether an entry has a usable start time (workTime 'HH:MM'). */
export function hasStart(x: RawTimeEntry): x is RawTimeEntry & { workTime: string } {
  return typeof x.workTime === 'string' && /^\d{1,2}:\d{2}$/.test(x.workTime)
}

/** Split text that holds several JSON objects one after another (JSON Lines or just concatenated). */
function splitObjects(text: string): string[] {
  const out: string[] = []
  let depth = 0, start = -1, inStr = false, esc = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}' && depth > 0) { depth--; if (depth === 0 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1 } }
  }
  return out
}

/**
 * Reads the time entries in one file. Accepts a single object, an array, an object with an
 * array inside (e.g. { "entries": [...] }), or several objects one after another (JSON Lines).
 */
export function parseTimeEntries(text: string): RawTimeEntry[] {
  try {
    const v = JSON.parse(text) as unknown
    if (Array.isArray(v)) return v.filter(isEntry)
    if (isEntry(v)) return [v]
    if (v && typeof v === 'object') {
      for (const val of Object.values(v)) if (Array.isArray(val)) return val.filter(isEntry)
    }
    return []
  } catch {
    const out: RawTimeEntry[] = []
    for (const chunk of splitObjects(text)) {
      try {
        const v = JSON.parse(chunk) as unknown
        if (isEntry(v)) out.push(v)
      } catch { /* skip */ }
    }
    return out
  }
}

export function parseTimeEntry(text: string): RawTimeEntry | null {
  const all = parseTimeEntries(text)
  return all.length === 1 ? all[0] : null
}

export class Service {
  private readonly gl: GitLabClient
  private readonly config: Config
  private project: GLProject | null = null
  private user: GLUser | null = null
  /** Blob contents never change for a given blob sha, so they are cached forever. */
  private readonly blobCache = new Map<string, RawTimeEntry[]>()
  private readonly commitCache = new Map<string, GLCommit | null>()
  private membersCache: { at: number; list: GLMember[] } | null = null

  private readonly cacheFile: string | null
  private cacheDirty = false

  constructor(config: Config, gl: GitLabClient, cacheFile: string | null = null) {
    this.config = config
    this.gl = gl
    this.cacheFile = cacheFile
    if (cacheFile) {
      // Time entries never change once committed, so keep them across restarts.
      try {
        const saved = JSON.parse(readFileSync(cacheFile, 'utf8')) as { v?: number; blobs: [string, RawTimeEntry[]][]; commits: [string, GLCommit | null][] }
        if (saved.v !== 2) throw new Error('old cache')
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
      await writeFile(this.cacheFile, JSON.stringify({ v: 2, blobs: [...this.blobCache], commits: [...this.commitCache] }))
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
        user: { id: user.id, username: user.username, name: user.name },
      }
    } catch (e) {
      return { ...base, error: (e as Error).message }
    }
  }

  private get branches(): string[] {
    return this.config.branch.split(',').map((b) => b.trim()).filter(Boolean)
  }

  /** All files under .time-tracking/YYYY/MM for the months in the range, per branch. */
  private async listFiles(projectId: number, from: string, to: string) {
    const files: (GLTreeItem & { branch: string })[] = []
    const folders: TimeDiagnosis['folders'] = []
    for (const branch of this.branches) {
      for (const month of monthsBetween(from, to)) {
        const path = `${this.config.timetrackingDir}/${month}`
        try {
          const items = await this.gl.getAll<GLTreeItem>(`/projects/${projectId}/repository/tree`, { path, ref: branch, recursive: true })
          const blobs = items.filter((i) => i.type === 'blob' && !/\.(md|gitkeep|txt)$/i.test(i.name) && i.name !== '.gitkeep')
          folders.push({ branch, path, files: blobs.length, error: null })
          files.push(...blobs.map((b) => ({ ...b, branch })))
        } catch (e) {
          // A month without any entries has no folder yet.
          folders.push({ branch, path, files: 0, error: e instanceof GitLabError && e.status === 404 ? 'map bestaat niet op deze branch' : (e as Error).message })
          if (!(e instanceof GitLabError && e.status === 404)) throw e
        }
      }
    }
    return { files, folders }
  }

  private isMine(user: GLUser, raw: RawTimeEntry, commit: GLCommit | null, learned: Set<number>): boolean {
    if (this.config.timetrackingUserId !== null) return raw.userId === this.config.timetrackingUserId
    if (raw.userId === user.id || learned.has(raw.userId)) return true
    return authoredBy(user, commit)
  }

  private async projectMembers(projectId: number): Promise<GLMember[]> {
    if (this.membersCache && Date.now() - this.membersCache.at < 3600_000) return this.membersCache.list
    let list: GLMember[] = []
    try {
      list = (await this.gl.getAll<GLMember>(`/projects/${projectId}/members/all`, {}, 5))
        .filter((m) => !m.bot && (m.state ?? 'active') === 'active' && !/(^|_)bot(_|\d|$)/i.test(m.username))
    } catch {
      /* without member access we still show you and the ids found in the entries */
    }
    this.membersCache = { at: Date.now(), list }
    return list
  }

  /** Team members of the project (from GitLab, read-only), you first. */
  async members(): Promise<TeamMember[]> {
    const { project, user } = await this.ensure()
    const list = await this.projectMembers(project.id)
    const all = list.some((m) => m.id === user.id) ? list : [{ id: user.id, username: user.username, name: user.name }, ...list]
    return all
      .map((m) => ({ id: m.id, username: m.username, name: m.name, isMe: m.id === user.id }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name))
  }

  async timeEntries(from: string, to: string): Promise<TimeEntry[]> {
    const { project, user } = await this.ensure()
    const members = await this.projectMembers(project.id)
    const { files } = await this.listFiles(project.id, from, to)

    const perFile = await pool(files, 6, async (file) => {
      if (!this.blobCache.has(file.id)) {
        const text = await this.gl.getText(`/projects/${project.id}/repository/blobs/${file.id}/raw`)
        this.blobCache.set(file.id, parseTimeEntries(text))
        this.cacheDirty = true
      }
      const raws = (this.blobCache.get(file.id) ?? []).filter((r) => r.date >= from && r.date <= to)
      if (!raws.length) return []
      const commitKey = `${file.path}@${file.id}`
      if (!this.commitCache.has(commitKey)) {
        const commits = await this.gl.get<GLCommit[]>(`/projects/${project.id}/repository/commits`, {
          ref_name: file.branch,
          path: file.path,
          per_page: 1,
        })
        this.commitCache.set(commitKey, commits[0] ?? null)
        this.cacheDirty = true
      }
      const c = this.commitCache.get(commitKey) ?? null
      return raws.map((raw, i) => ({ raw, file, c, i }))
    })
    await this.persistCache()

    // If your commits carry a tijdregistratie userId that differs from your GitLab id, learn it.
    const flat = perFile.flat()
    const learned = new Set(flat.filter((x) => authoredBy(user, x.c)).map((x) => x.raw.userId))
    // Work out whose entry it is: by tijdregistratie userId = GitLab id, otherwise by commit author.
    const people = members.some((m) => m.id === user.id) ? members : [user, ...members]
    const byAuthor = (c: GLCommit | null) => (c ? people.find((m) => authoredBy(m, c)) ?? null : null)
    const learnedPerson = new Map<number, number>()
    for (const x of flat) {
      if (people.some((m) => m.id === x.raw.userId)) continue
      const p = byAuthor(x.c)
      if (p && !learnedPerson.has(x.raw.userId)) learnedPerson.set(x.raw.userId, p.id)
    }
    const seen = new Set<string>()
    const entries: TimeEntry[] = []
    for (const { raw, file, c, i } of flat) {
      const id = raw.id ?? `${file.id}-${i}`
      if (seen.has(id)) continue
      seen.add(id)
      const mine = this.isMine(user, raw, c, learned)
      const personId = mine
        ? user.id
        : people.some((m) => m.id === raw.userId)
          ? raw.userId
          : learnedPerson.get(raw.userId) ?? byAuthor(c)?.id ?? null
      entries.push({
        id,
        date: raw.date,
        start: hasStart(raw) ? raw.workTime.padStart(5, '0') : null,
        end: hasStart(raw) ? addMinutes(raw.workTime, raw.durationMinutes) : null,
        durationMinutes: raw.durationMinutes,
        note: raw.note ?? '',
        issueIid: raw.issueIid ?? null,
        issueUrl: raw.issueIid ? `${project.web_url}/-/issues/${raw.issueIid}` : null,
        processStepId: raw.processStepId ?? null,
        skillId: raw.skillId ?? null,
        userId: raw.userId,
        mine,
        personId,
        personName: people.find((m) => m.id === personId)?.name ?? null,
        file: file.path,
        commit: c ? { sha: c.id, shortSha: c.short_id, url: c.web_url, title: c.title } : null,
      })
    }
    // Entries without a start time come first on their day.
    return entries.sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))
  }

  /** Explains what the app finds, to help when no hours show up. */
  async diagnoseTime(from: string, to: string): Promise<TimeDiagnosis> {
    const { project, user } = await this.ensure()
    const { folders } = await this.listFiles(project.id, from, to)
    const entries = await this.timeEntries(from, to)
    const userIds: Record<string, number> = {}
    for (const e of entries) userIds[e.userId] = (userIds[e.userId] ?? 0) + 1
    // Look on every branch for commits that touch the time-tracking folders.
    const otherBranches = new Set<string>()
    let recentCommits: TimeDiagnosis['recentCommits'] = []
    for (const month of monthsBetween(from, to)) {
      try {
        const commits = await this.gl.get<GLCommit[]>(`/projects/${project.id}/repository/commits`, {
          all: true, path: `${this.config.timetrackingDir}/${month}`, per_page: 5,
        })
        recentCommits = recentCommits.concat(commits.map((c) => ({ title: c.title, url: c.web_url, author: c.author_name ?? '', date: c.created_at })))
        for (const c of commits.slice(0, 3)) {
          const refs = await this.gl.get<{ type: string; name: string }[]>(`/projects/${project.id}/repository/commits/${c.id}/refs`, { type: 'branch' })
          for (const r of refs) if (!this.branches.includes(r.name)) otherBranches.add(r.name)
        }
      } catch { /* diagnostics are best effort */ }
    }
    return {
      branches: this.branches,
      folders,
      entriesInRange: entries.length,
      mine: entries.filter((e) => e.mine).length,
      userIds,
      gitlabUserId: user.id,
      configuredUserId: this.config.timetrackingUserId,
      otherBranches: [...otherBranches],
      recentCommits: recentCommits.slice(0, 5),
    }
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

function authoredBy(user: GLUser | GLMember, c: GLCommit | null): boolean {
  if (!c) return false
  const u = user as GLUser
  const emails = [u.email, u.public_email, u.commit_email].filter(Boolean).map((e) => e!.toLowerCase())
  if (c.author_email && emails.includes(c.author_email.toLowerCase())) return true
  return !!c.author_name && (c.author_name === user.name || c.author_name === user.username)
}
