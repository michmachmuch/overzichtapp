import { addDays, parseYmd, ymd } from './format'
import type { Sprint, TimeEntry } from '../shared/types'

/** Sprint start and end as sortable 'YYYY-MM-DDTHH:MM' strings (end is exclusive). */
export const sprintStart = (s: Sprint) => `${s.start}T${s.startTime || '00:00'}`
export const sprintEnd = (s: Sprint) => `${s.end}T${s.endTime || '24:00'}`

/** Local 'YYYY-MM-DDTHH:MM' for a moment. */
export function stamp(d = new Date()): string {
  return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function currentSprint(sprints: Sprint[], now = stamp()): Sprint | null {
  return sprints.find((s) => sprintStart(s) <= now && now < sprintEnd(s)) ?? null
}

export function nextSprint(sprints: Sprint[], now = stamp()): Sprint | null {
  return [...sprints].filter((s) => sprintStart(s) > now).sort((a, b) => sprintStart(a).localeCompare(sprintStart(b)))[0] ?? null
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
  // An entry counts when it starts within the sprint, using the sprint's start and end time.
  const from = sprintStart(sprint)
  const to = sprintEnd(sprint)
  const loggedMinutes = entries
    .filter((e) => { const t = `${e.date}T${e.start ?? '00:00'}`; return t >= from && t < to })
    .reduce((s, e) => s + e.durationMinutes, 0)
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
