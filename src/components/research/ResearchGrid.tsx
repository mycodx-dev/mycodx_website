import type { ResearchProject } from '../../data/researchProjects'
import ResearchCard from './ResearchCard'

interface ResearchGridProps {
  items: ResearchProject[]
}

export default function ResearchGrid({ items }: ResearchGridProps) {
  return (
    <div className="research-project-list">
      {items.map((item, index) => (
        <ResearchCard key={item.id} project={item} index={index} />
      ))}
    </div>
  )
}
