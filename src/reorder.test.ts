import { describe, expect, it } from 'vitest'
import { dragTarget, dropIndex, moveItem, reorderOpen, rowShift, slotOffset } from './reorder'
import type { Todo } from '../shared/types'

const todo = (id: string, done = false): Todo => ({ id, title: id, note: '', done, createdAt: '', doneAt: done ? '2026-11-26T10:00:00Z' : null })

describe('reorder', () => {
  it('moves an item', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 1, 9)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
  it('reorders open to-dos and keeps finished ones', () => {
    const todos = [todo('a'), todo('x', true), todo('b'), todo('c')]
    expect(reorderOpen(todos, ['c', 'a', 'b']).map((t) => t.id)).toEqual(['c', 'a', 'b', 'x'])
    // unknown ids are ignored, nothing gets lost
    expect(reorderOpen(todos, ['b', 'zz']).map((t) => t.id)).toEqual(['b', 'a', 'x', 'c'])
  })
  it('finds where to drop', () => {
    const middles = [10, 30, 50]
    expect(dropIndex(5, middles)).toBe(0)
    expect(dropIndex(35, middles)).toBe(2)
    expect(dropIndex(99, middles)).toBe(3)
  })
})

describe('drag geometry', () => {
  // Three 40px rows with 8px gaps: 0-40, 48-88, 96-136
  const rows = [{ top: 0, bottom: 40 }, { top: 48, bottom: 88 }, { top: 96, bottom: 136 }]
  it('finds the target slot from the dragged row middle', () => {
    expect(dragTarget(0, 20, rows)).toBe(0)
    expect(dragTarget(0, 70, rows)).toBe(1)
    expect(dragTarget(0, 130, rows)).toBe(2)
    expect(dragTarget(2, 10, rows)).toBe(0)
  })
  it('slides the rows in between aside by the dragged row size', () => {
    expect([0, 1, 2].map((i) => rowShift(i, 0, 2, rows))).toEqual([0, -48, -48])
    expect([0, 1, 2].map((i) => rowShift(i, 2, 0, rows))).toEqual([48, 48, 0])
    expect([0, 1, 2].map((i) => rowShift(i, 1, 1, rows))).toEqual([0, 0, 0])
  })
  it('knows where the dragged row lands', () => {
    expect(slotOffset(0, 2, rows)).toBe(96)
    expect(slotOffset(2, 0, rows)).toBe(-96)
    expect(slotOffset(1, 1, rows)).toBe(0)
  })
})
