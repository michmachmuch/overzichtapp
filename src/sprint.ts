import { addDays, parseYmd, ymd } from './format'
import type { Sprint, TimeEntry } from '../shared/types'

export function currentSprint(sprints: Sprint[], today = ymd(new Date())): Sprint | null {
  return sprints.find((s) => s.start <= today && today <= s.end) ?? null
}

export function nextSprint(sprints: Sprint[], today = ymd(new Date())): Sprint | null {
  return [...sprints].filter((s) => s.start > today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
}

/** Monday to Friday between two dates, both inclusive. */
export function workdays(from: string, to: string): number {
  if (to < from) return 0
  let n = 0
  for (let d = parseYmd(from); ymd(d) <= to; d = addDays(d, 1)) if (d.getDay() !== 0 && d.getDay() !== 6) n++
  return n
}

export interface SprintProgress {
  loggedMinutes: number
  targetMinutes: number
  /** Minutes you would have logged by the end of today at an even pace over the workdays. */
  expectedMinutes: number
  remainingMinutes: number
  workdaysTotal: number
  workdaysLeft: number
  /** Minutes per remaining workday (today included) to reach the target. */
  perDayMinutes: number
  status: 'klaar' | 'voor' | 'op-schema' | 'achter'
}

export function sprintProgress(sprint: Sprint, entries: TimeEntry[], targetHours: number, today = ymd(new Date())): SprintProgress {
  const targetMinutes = targetHours * 60
  const loggedMinutes = entries.filter((e) => e.date >= sprint.start && e.date <= sprint.end).reduce((s, e) => s + e.durationMinutes, 0)
  const workdaysTotal = Math.max(1, workdays(sprint.start, sprint.end))
  const elapsed = workdays(sprint.start, today < sprint.end ? today : sprint.end)
  const expectedMinutes = Math.round((targetMinutes * elapsed) / workdaysTotal)
  const remainingMinutes = Math.max(0, targetMinutes - loggedMinutes)
  const workdaysLeft = workdays(today > sprint.start ? today : sprint.start, sprint.end)
  const perDayMinutes = workdaysLeft ? Math.ceil(remainingMinutes / workdaysLeft) : remainingMinutes
  const diff = loggedMinutes - expectedMinutes
  const status = remainingMinutes === 0 ? 'klaar' : diff >= 60 ? 'voor' : diff <= -60 ? 'achter' : 'op-schema'
  return { loggedMinutes, targetMinutes, expectedMinutes, remainingMinutes, workdaysTotal, workdaysLeft, perDayMinutes, status }
}
