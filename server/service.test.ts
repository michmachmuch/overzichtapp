import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { addMinutes, monthsBetween, parseTimeEntries, parseTimeEntry, Service } from './service.ts'
import { GitLabClient, type FetchLike } from './gitlab.ts'
import { demoFetch } from './demo.ts'
import { loadConfig } from './config.ts'
import { migrate, Store } from './store.ts'
import { createApp } from './app.ts'
import type { LocalData } from '../shared/types.ts'

// The exact format the tijdregistratie program writes (example from Mischa).
const SAMPLE = JSON.stringify({
  schemaVersion: 1,
  id: '44b4db50-889f-4377-8333-27e2daf0f73b',
  createdAt: '2026-11-24T15:35:08.475Z',
  userId: 3761,
  projectId: 7023,
  issueIid: 71,
  branch: 'develop',
  catalogVersion: '1.1.1',
  processId: 'scrum-proces',
  processStepId: 'scrum-proces-plannen-sprint',
  skillId: 'scrum-proces-vaardigheid-kiezen-user-stories',
  date: '2026-11-24',
  durationMinutes: 30,
  workTime: '16:00',
  note: 'Brainstormen en verfijnen voorstellen nieuwe functies en epic',
})

function setup(fetchFn: FetchLike = demoFetch()) {
  const config = { ...loadConfig({}), gitlabProject: 'demo', gitlabToken: 'x' }
  const methods: string[] = []
  const spy: FetchLike = (url, init) => {
    methods.push((init as { method: string }).method)
    return fetchFn(url, init)
  }
  return { service: new Service(config, new GitLabClient('https://gitlab.example', 'x', spy)), methods }
}

describe('helpers', () => {
  it('computes end times', () => {
    expect(addMinutes('16:00', 30)).toBe('16:30')
    expect(addMinutes('9:45', 90)).toBe('11:15')
  })
  it('lists the months of a range', () => {
    expect(monthsBetween('2026-11-23', '2026-12-06')).toEqual(['2026/11', '2026/12'])
    expect(monthsBetween('2026-12-28', '2027-01-03')).toEqual(['2026/12', '2027/01'])
  })
  it('parses a tijdregistratie entry', () => {
    const e = parseTimeEntry(SAMPLE)
    expect(e?.workTime).toBe('16:00')
    expect(e?.durationMinutes).toBe(30)
    expect(parseTimeEntry('{"foo":1}')).toBeNull()
    // entries without a start time are kept (absent, empty or null workTime)
    const { workTime: _drop, ...noTime } = JSON.parse(SAMPLE)
    expect(parseTimeEntry(JSON.stringify(noTime))?.durationMinutes).toBe(30)
    expect(parseTimeEntry(JSON.stringify({ ...noTime, workTime: '' }))).not.toBeNull()
    expect(parseTimeEntry(JSON.stringify({ ...noTime, workTime: null }))).not.toBeNull()
    expect(parseTimeEntry('not json')).toBeNull()
  })
  it('reads files with several entries (array, wrapped array, JSON Lines, concatenated)', () => {
    const two = JSON.parse(SAMPLE)
    const other = { ...two, id: 'b', workTime: '15:00' }
    expect(parseTimeEntries(JSON.stringify([two, other]))).toHaveLength(2)
    expect(parseTimeEntries(JSON.stringify({ entries: [two, other] }))).toHaveLength(2)
    expect(parseTimeEntries(JSON.stringify(two) + '\n' + JSON.stringify(other) + '\n')).toHaveLength(2)
    expect(parseTimeEntries(JSON.stringify(two, null, 2) + '\n\n' + JSON.stringify(other, null, 2))).toHaveLength(2)
  })
})

describe('Service', () => {
  it('reads time entries with their commit', async () => {
    const { service } = setup()
    const today = new Date()
    const from = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)
    const to = today.toISOString().slice(0, 10)
    const entries = await service.timeEntries(from, to)
    expect(entries.length).toBeGreaterThan(0)
    for (const e of entries) {
      expect(e.date >= from && e.date <= to).toBe(true)
      expect(e.commit?.url).toMatch(/\/-\/commit\//)
      if (e.start) expect(e.end! > e.start).toBe(true)
      else expect(e.end).toBeNull()
    }
    expect(entries.some((e) => e.start === null)).toBe(true)
  })

  it('reads a real-format entry from .time-tracking/YYYY/MM', async () => {
    const paths: string[] = []
    const fake: FetchLike = async (url) => {
      const u = new URL(url)
      paths.push(u.pathname + '?' + u.searchParams.toString())
      const ok = (body: unknown) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
      if (u.pathname.endsWith('/user')) return ok({ id: 3761, username: 'm', name: 'M' })
      if (u.pathname.endsWith('/repository/tree')) return ok([{ id: 'abc', name: 'x.json', type: 'blob', path: '.time-tracking/2026/11/x.json' }])
      if (u.pathname.endsWith('/raw')) return ok(SAMPLE)
      if (u.pathname.endsWith('/repository/commits')) return ok([{ id: 'f'.repeat(40), short_id: 'ffffffff', title: 't', web_url: 'https://g/p/-/commit/fff', created_at: '' }])
      return ok({ id: 7023, name: 'P', web_url: 'https://g/p', path_with_namespace: 'p' })
    }
    const { service } = setup(fake)
    const [e] = await service.timeEntries('2026-11-23', '2026-11-29')
    expect(e).toMatchObject({ date: '2026-11-24', start: '16:00', end: '16:30', issueIid: 71, issueUrl: 'https://g/p/-/issues/71' })
    expect(e.commit?.url).toBe('https://g/p/-/commit/fff')
    expect(paths.some((p) => p.includes('path=.time-tracking%2F2026%2F11') && p.includes('ref=develop'))).toBe(true)
  })

  it('reads an entry without start time (real format) and ignores blobs cached by an older version', async () => {
    // Exactly as the tijdregistratie program writes it when no start time is entered: no workTime, issueIid null.
    const noStart = JSON.stringify({
      schemaVersion: 1, id: 'ddb10019-96bb-4301-9aea-47e67e759d98', createdAt: '2026-11-23T20:28:55.573Z', userId: 3761, projectId: 7023,
      issueIid: null, branch: 'develop', catalogVersion: '1.1.1', processId: 'ontwerpproces', processStepId: 'ontwerpproces-opstellen-ontwerp',
      skillId: 'ontwerpproces-vaardigheid-iteratief-verfijnen-ontwerp', date: '2026-11-20', durationMinutes: 180, note: 'Schermontwerpen in Figma uitgewerkt',
    }, null, 2)
    const fake: FetchLike = async (url) => {
      const u = new URL(url)
      const ok = (body: unknown) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
      if (u.pathname.endsWith('/user')) return ok({ id: 3761, username: 'm', name: 'M' })
      if (u.pathname.endsWith('/repository/tree')) return ok([{ id: 'blob-no-start', name: 'x.json', type: 'blob', path: '.time-tracking/2026/11/x.json' }])
      if (u.pathname.endsWith('/raw')) return ok(noStart)
      if (u.pathname.endsWith('/repository/commits')) return ok([{ id: 'f'.repeat(40), short_id: 'ffffffff', title: 't', web_url: 'https://g/p/-/commit/fff', created_at: '' }])
      return ok({ id: 7023, name: 'P', web_url: 'https://g/p', path_with_namespace: 'p' })
    }
    // A cache written by v1.0.0, which could not read this file and stored it as empty.
    const cacheFile = join(mkdtempSync(join(tmpdir(), 'ov-cache-')), 'gitlab-cache.json')
    writeFileSync(cacheFile, JSON.stringify({ v: 2, blobs: [['blob-no-start', []]], commits: [] }))
    const config = { ...loadConfig({}), gitlabProject: 'demo', gitlabToken: 'x' }
    const service = new Service(config, new GitLabClient('https://gitlab.example', 'x', fake), cacheFile)
    const entries = await service.timeEntries('2026-11-16', '2026-11-22')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ date: '2026-11-20', start: null, end: null, durationMinutes: 180, issueIid: null, issueUrl: null, mine: true })
    expect(JSON.parse(readFileSync(cacheFile, 'utf8')).v).toBe(3)
  })

  it('recognises your entries by commit author when the userId differs from your GitLab id', async () => {
    const fake: FetchLike = async (url) => {
      const u = new URL(url)
      const ok = (body: unknown) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
      if (u.pathname.endsWith('/user')) return ok({ id: 99, username: 'mischa', name: 'Mischa', email: 'm@school.nl' })
      if (u.pathname.endsWith('/repository/tree')) return ok([{ id: 'abc', name: 'x.jsonl', type: 'blob', path: '.time-tracking/2026/11/x.jsonl' }])
      if (u.pathname.endsWith('/raw')) return ok(SAMPLE + '\n' + SAMPLE.replace('44b4db50', 'second').replace('16:00', '09:00'))
      if (u.pathname.endsWith('/repository/commits')) return ok([{ id: 'f'.repeat(40), short_id: 'ffffffff', title: 't', web_url: 'https://g/p/-/commit/fff', created_at: '', author_name: 'Mischa', author_email: 'M@school.nl' }])
      return ok({ id: 7023, name: 'P', web_url: 'https://g/p', path_with_namespace: 'p' })
    }
    const { service } = setup(fake)
    const entries = await service.timeEntries('2026-11-23', '2026-11-29')
    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e.mine)).toBe(true)
  })

  it('lists team members (you first) and links entries to them', async () => {
    const { service } = setup()
    const members = await service.members()
    expect(members[0]).toMatchObject({ id: 3761, isMe: true })
    expect(members.map((m) => m.name)).toContain('Sam de Vries')
    const today = new Date()
    const from = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10)
    const entries = await service.timeEntries(from, today.toISOString().slice(0, 10))
    const sam = entries.filter((e) => e.personId === 4102)
    expect(sam.length).toBeGreaterThan(0)
    expect(sam.every((e) => !e.mine && e.personName === 'Sam de Vries')).toBe(true)
    expect(entries.filter((e) => e.mine).every((e) => e.personId === 3761)).toBe(true)
  })

  it('explains what it finds', async () => {
    const { service } = setup()
    const d = await service.diagnoseTime('2026-11-01', '2026-11-30')
    expect(d.branches).toEqual(['develop'])
    expect(d.folders[0].path).toBe('.time-tracking/2026/11')
    expect(d.mine).toBeGreaterThan(0)
    expect(d.entriesInRange).toBeGreaterThan(d.mine)
    expect(Object.keys(d.userIds)).toHaveLength(3)
  })

  it('counts new issues and merge requests for check-ins', async () => {
    const { service } = setup()
    const s = await service.checkinStatus({ id: '1', title: 'Issues', kind: 'gitlab-issues', url: '', info: '', lastCheckedAt: null })
    expect(s.newCount).toBeGreaterThan(0)
    const later = await service.checkinStatus({ id: '1', title: 'Issues', kind: 'gitlab-issues', url: '', info: '', lastCheckedAt: new Date().toISOString() })
    expect(later.newCount).toBe(0)
  })

  it('only ever sends GET requests to GitLab', async () => {
    const { service, methods } = setup()
    await service.status()
    await service.timeEntries('2026-11-01', '2026-11-30')
    await service.myIssues()
    await service.mergeRequests()
    await service.checkinStatus({ id: '1', title: 'MR', kind: 'gitlab-merge-requests', url: '', info: '', lastCheckedAt: null })
    expect(methods.length).toBeGreaterThan(0)
    expect(new Set(methods)).toEqual(new Set(['GET']))
  })

  it('has no code that can write to GitLab', () => {
    const src = readFileSync(new URL('./gitlab.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(src).not.toMatch(/['"](POST|PUT|PATCH|DELETE)['"]/)
  })
})

describe('local data', () => {
  it('upgrades data saved by an older version', () => {
    const old = { version: 1, checkins: [], deadlines: [], todos: [] } as unknown as LocalData
    expect(migrate(old)).toMatchObject({ sprints: [], sprintHoursTarget: 64 })
  })
})

describe('HTTP API', () => {
  it('saves local data and marks a check-in as checked', async () => {
    const { service } = setup()
    const store = new Store(mkdtempSync(join(tmpdir(), 'overzicht-')))
    const server = createApp(service, store, null).listen(0)
    const base = `http://localhost:${(server.address() as AddressInfo).port}`
    try {
      const data = (await (await fetch(`${base}/api/data`)).json()) as LocalData
      expect(data.checkins.map((c) => c.title)).toEqual(['WhatsApp-groep', 'Issueboard', 'Merge requests'])
      data.todos.push({ id: 't', title: 'Test', note: '', done: false, createdAt: '', doneAt: null })
      expect((await fetch(`${base}/api/data`, { method: 'PUT', body: JSON.stringify(data) })).status).toBe(200)
      const res = await fetch(`${base}/api/checkins/${data.checkins[1].id}/checked`, { method: 'POST' })
      const after = (await res.json()) as LocalData
      expect(after.todos).toHaveLength(1)
      expect(after.checkins[1].lastCheckedAt).not.toBeNull()
      expect((await fetch(`${base}/api/data`, { method: 'PUT', body: '{"bad":true}' })).status).toBe(400)
      expect((await fetch(`${base}/api/time?from=x&to=y`)).status).toBe(400)
    } finally {
      server.close()
    }
  })
})
