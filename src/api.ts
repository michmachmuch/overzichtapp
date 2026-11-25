import { useCallback, useEffect, useState } from 'react'
import type { TeamMember, CheckinStatus, GitLabIssue, LocalData, Status, TimeDiagnosis, TimeEntry } from '../shared/types'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Fout ${res.status}`)
  return body as T
}

export const api = {
  status: () => call<Status>('/api/status'),
  time: (from: string, to: string) => call<TimeEntry[]>(`/api/time?from=${from}&to=${to}`),
  diagnoseTime: (from: string, to: string) => call<TimeDiagnosis>(`/api/time/diagnose?from=${from}&to=${to}`),
  members: () => call<TeamMember[]>('/api/members'),
  issues: () => call<GitLabIssue[]>('/api/issues'),
  checkins: () => call<CheckinStatus[]>('/api/checkins'),
  markChecked: (id: string) => call<LocalData>(`/api/checkins/${id}/checked`, { method: 'POST' }),
  data: () => call<LocalData>('/api/data'),
  saveData: (d: LocalData) => call<LocalData>('/api/data', { method: 'PUT', body: JSON.stringify(d) }),
}

/** Small fetch hook: { data, error, loading, reload }. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fn()
      .then((d) => { if (alive) { setData(d); setError(null) } })
      .catch((e: Error) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload, setData }
}

export const newId = () => crypto.randomUUID()
