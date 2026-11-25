import { describe, expect, it } from 'vitest'
import { dmy, parseDmy } from './format'

describe('dd/mm/yyyy dates', () => {
  it('formats', () => expect(dmy('2026-12-04')).toBe('04/12/2026'))
  it('parses', () => {
    expect(parseDmy('04/12/2026')).toBe('2026-12-04')
    expect(parseDmy('4-12-2026')).toBe('2026-12-04')
    expect(parseDmy('31/02/2026')).toBeNull()
    expect(parseDmy('12/2026')).toBeNull()
  })
})
