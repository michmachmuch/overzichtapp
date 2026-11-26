import type { Todo } from '../shared/types'

/** A copy of `list` with the item at `from` moved to index `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list]
  if (from < 0 || from >= out.length) return out
  const [item] = out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item)
  return out
}

/**
 * Put the open to-do's in the given order. Finished ones keep their relative order after them
 * (they are shown sorted by when they were finished anyway).
 */
export function reorderOpen(todos: readonly Todo[], openIds: readonly string[]): Todo[] {
  const byId = new Map(todos.map((t) => [t.id, t]))
  const open = openIds.map((id) => byId.get(id)).filter((t): t is Todo => !!t && !t.done)
  const rest = todos.filter((t) => !open.includes(t))
  return [...open, ...rest]
}

/** Index a dragged item should go to, given the pointer's y and the other rows' vertical middles (top to bottom). */
export function dropIndex(pointerY: number, middles: readonly number[]): number {
  const i = middles.findIndex((m) => pointerY < m)
  return i === -1 ? middles.length : i
}
