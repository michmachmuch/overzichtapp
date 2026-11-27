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

/** Where a row sits on screen when a drag starts. */
export interface RowBox { top: number; bottom: number }

/** Index the dragged row (originally at `start`) would land on, given its current vertical middle. */
export function dragTarget(start: number, middleY: number, rows: readonly RowBox[]): number {
  const middles = rows.filter((_, i) => i !== start).map((r) => (r.top + r.bottom) / 2)
  return dropIndex(middleY, middles)
}

/** How far (px) another row slides aside while the row from `start` hovers at `target`. */
export function rowShift(i: number, start: number, target: number, rows: readonly RowBox[]): number {
  if (i === start || rows.length < 2) return 0
  // The space the dragged row takes up, including the gap to its neighbour.
  const gap = rows.length > 1 ? rows[1].top - rows[0].bottom : 0
  const size = rows[start].bottom - rows[start].top + gap
  if (start < i && i <= target) return -size
  if (target <= i && i < start) return size
  return 0
}

/** How far (px) the dragged row has to move from where it started to sit in slot `target`. */
export function slotOffset(start: number, target: number, rows: readonly RowBox[]): number {
  if (target > start) return rows[target].bottom - rows[start].bottom
  if (target < start) return rows[target].top - rows[start].top
  return 0
}
