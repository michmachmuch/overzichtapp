import type { Member } from '../state/types'

export function Avatar({ member, size = 26 }: { member: Member | null | undefined; size?: number }) {
  if (!member) return <span className="avatar avatar-empty" style={{ width: size, height: size }} title="Unassigned">?</span>
  const initials = member.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="avatar" title={member.name} style={{ width: size, height: size, background: member.color, fontSize: size * 0.42 }}>
      {initials}
    </span>
  )
}
