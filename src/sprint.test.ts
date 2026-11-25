import { describe, expect, it } from 'vitest'
import { currentSprint, sprintProgress, workdays } from './sprint'
import type { TimeEntry } from '../shared/types'

const sprint = { id: 's', name: 'Sprint 3', start: '2026-11-23', end: '2026-12-04' } // 2 weeks, 10 workdays
const entry = (date: string, minutes: number, start = '09:00') => ({ date, start, durationMinutes: minutes } as TimeEntry)

describe('sprint progress', () => {
  it('counts workdays', () => {
    expect(workdays('2026-11-23', '2026-12-04')).toBe(10)
    expect(workdays('2026-11-28', '2026-11-29')).toBe(0)
  })
  it('finds the current sprint', () => {
    expect(currentSprint([sprint], '2026-11-25T10:00')?.id).toBe('s')
    expect(currentSprint([sprint], '2026-12-05T10:00')).toBeNull()
    const midday = { ...sprint, startTime: '13:00', endTime: '12:00' }
    expect(currentSprint([midday], '2026-11-23T12:59')).toBeNull()
    expect(currentSprint([midday], '2026-11-23T13:00')?.id).toBe('s')
    expect(currentSprint([midday], '2026-12-04T12:00')).toBeNull()
  })
  it('compares with an even pace', () => {
    // Wednesday: 3 of 10 workdays → expected 19.2h of 64h
    const onTrack = sprintProgress(sprint, [entry('2026-11-23', 600), entry('2026-11-24', 560)], 64, '2026-11-25')
    expect(onTrack.expectedMinutes).toBe(1152)
    expect(onTrack.status).toBe('op-schema')
    expect(onTrack.workdaysLeft).toBe(8)
    expect(onTrack.perDayMinutes).toBe(Math.ceil((3840 - 1160) / 8))
    const behind = sprintProgress(sprint, [entry('2026-11-23', 120)], 64, '2026-11-25')
    expect(behind.status).toBe('achter')
    const done = sprintProgress(sprint, [entry('2026-11-23', 64 * 60)], 64, '2026-11-25')
    expect(done.status).toBe('klaar')
    // entries outside the sprint don't count
    expect(sprintProgress(sprint, [entry('2026-11-20', 600)], 64, '2026-11-25').loggedMinutes).toBe(0)
    // with times: the morning before a midday start does not count, the afternoon does
    const midday = { ...sprint, startTime: '13:00', endTime: '12:00' }
    const p = sprintProgress(midday, [entry('2026-11-23', 60, '10:00'), entry('2026-11-23', 90, '14:00'), entry('2026-12-04', 30, '13:00')], 64, '2026-11-25')
    expect(p.loggedMinutes).toBe(90)
  })
})
