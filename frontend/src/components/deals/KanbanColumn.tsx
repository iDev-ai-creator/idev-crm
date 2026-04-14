import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './KanbanCard'
import type { Deal } from '../../api/deals'

export default function KanbanColumn({ status, label, deals }: { status: string; label: string; deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex-shrink-0 w-60">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">{label}</h3>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{deals.length}</span>
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`min-h-20 space-y-2 rounded-[var(--radius-lg)] p-2 transition-colors
            ${isOver ? 'bg-[var(--accent)]/8' : 'bg-[var(--bg-hover)]/40'}`}
        >
          {deals.map((deal) => <KanbanCard key={deal.id} deal={deal} />)}
        </div>
      </SortableContext>
    </div>
  )
}
