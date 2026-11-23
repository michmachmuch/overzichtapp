import type { Member, Story } from '../state/types'
import { Avatar } from './Avatar'

export function PriorityTag({ priority }: { priority: Story['priority'] }) {
  const short = { must: 'Must', should: 'Should', could: 'Could', wont: "Won't" }[priority]
  return <span className={`tag tag-${priority}`}>{short}</span>
}

export function Points({ points }: { points: number | null }) {
  return <span className="points" title="Story points">{points ?? '–'}</span>
}

export function StoryCard({ story, member, onOpen, draggable }: { story: Story; member?: Member; onOpen: () => void; draggable?: boolean }) {
  return (
    <div
      className={`card story-card ${story.status === 'done' ? 'is-done' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/story-id', story.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="button"
    >
      <div className="story-title">{story.title}</div>
      <div className="story-meta">
        <PriorityTag priority={story.priority} />
        <Points points={story.points} />
        <span className="spacer" />
        <Avatar member={member} size={22} />
      </div>
    </div>
  )
}
