import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem, reorderOpen } from './reorder'
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
