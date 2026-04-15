import { useState, useEffect, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

interface BacklogItem {
  id: number
  title: string
  description: string
  status: 'idea' | 'in_progress' | 'testing' | 'done'
  author: { id: number; full_name: string } | null
  votes: number
  order: number
  comments_count: number
  created_at: string
}

const COLUMNS: { status: BacklogItem['status']; label: string }[] = [
  { status: 'idea', label: '💡 Ideas' },
  { status: 'in_progress', label: '🔧 In Progress' },
  { status: 'testing', label: '🧪 Testing' },
  { status: 'done', label: '✅ Done' },
]

type Board = Record<BacklogItem['status'], BacklogItem[]>

// ─── Sortable card ────────────────────────────────────────────────────────────
function BacklogCard({ item, onVote }: { item: BacklogItem; onVote: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-[var(--bg-main)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3 cursor-grab active:cursor-grabbing hover:border-[var(--accent)]/40 transition-colors shadow-sm"
    >
      <p className="text-sm font-medium text-[var(--text)] mb-1">{item.title}</p>
      {item.description && (
        <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">{item.description}</p>
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={(e) => { e.stopPropagation(); onVote(item.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          👍 {item.votes}
        </button>
        {item.author && (
          <span className="text-xs text-[var(--text-secondary)] truncate max-w-[7rem]">
            {item.author.full_name}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function BacklogColumn({
  status,
  label,
  items,
  onVote,
}: {
  status: BacklogItem['status']
  label: string
  items: BacklogItem[]
  onVote: (id: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex-shrink-0 w-64">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">{label}</h3>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`min-h-20 space-y-2 rounded-[var(--radius-lg)] p-2 transition-colors
            ${isOver ? 'bg-[var(--accent)]/8' : 'bg-[var(--bg-hover)]/40'}`}
        >
          {items.map((item) => (
            <BacklogCard key={item.id} item={item} onVote={onVote} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BacklogPage() {
  const { t } = useTranslation()
  const [board, setBoard] = useState<Board>({ idea: [], in_progress: [], testing: [], done: [] })
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    const { data } = await api.get('/backlog/?page_size=200')
    const items: BacklogItem[] = Array.isArray(data) ? data : data.results ?? []
    const grouped: Board = { idea: [], in_progress: [], testing: [], done: [] }
    items.forEach((item) => { (grouped[item.status] ??= []).push(item) })
    COLUMNS.forEach(({ status }) => { grouped[status].sort((a, b) => a.order - b.order) })
    setBoard(grouped)
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const vote = async (id: number) => {
    await api.post(`/backlog/${id}/vote/`)
    setBoard((prev) => {
      const next = { ...prev }
      for (const status of Object.keys(next) as BacklogItem['status'][]) {
        next[status] = next[status].map((i) => i.id === id ? { ...i, votes: i.votes + 1 } : i)
      }
      return next
    })
  }

  const addIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const { data } = await api.post('/backlog/', { title: newTitle.trim(), status: 'idea' })
      setBoard((prev) => ({ ...prev, idea: [data, ...prev.idea] }))
      setNewTitle('')
    } finally {
      setAdding(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const overId = String(over.id)

    // Find which column the active item is in
    let fromStatus: BacklogItem['status'] | '' = ''
    for (const [s, items] of Object.entries(board)) {
      if (items.find((i) => i.id === activeId)) { fromStatus = s as BacklogItem['status']; break }
    }
    if (!fromStatus) return

    // Determine target column
    const isColumnId = COLUMNS.some((c) => c.status === overId)
    const toStatus: BacklogItem['status'] = isColumnId
      ? (overId as BacklogItem['status'])
      : (() => {
          for (const [s, items] of Object.entries(board)) {
            if (items.find((i) => i.id === Number(overId))) return s as BacklogItem['status']
          }
          return fromStatus
        })()

    const newBoard = { ...board }

    if (fromStatus === toStatus) {
      // Reorder within same column
      const col = [...newBoard[fromStatus]]
      const oi = col.findIndex((i) => i.id === activeId)
      const ni = col.findIndex((i) => i.id === Number(overId))
      if (oi === ni || ni < 0) return
      newBoard[fromStatus] = arrayMove(col, oi, ni)
    } else {
      // Move to different column
      const moving = { ...newBoard[fromStatus].find((i) => i.id === activeId)!, status: toStatus }
      newBoard[fromStatus] = newBoard[fromStatus].filter((i) => i.id !== activeId)
      const toCol = [...(newBoard[toStatus] ?? [])]
      const insertAt = toCol.findIndex((i) => i.id === Number(overId))
      insertAt >= 0 ? toCol.splice(insertAt, 0, moving) : toCol.push(moving)
      newBoard[toStatus] = toCol
    }
    setBoard(newBoard)

    try {
      if (fromStatus !== toStatus) {
        await api.patch(`/backlog/${activeId}/`, { status: toStatus })
      }
      // Persist order for the affected column
      const reorderCols = fromStatus === toStatus ? [toStatus] : [fromStatus, toStatus]
      await Promise.all(
        reorderCols.map((col) =>
          Promise.all(
            newBoard[col].map((item, idx) =>
              api.patch(`/backlog/${item.id}/`, { order: idx })
            )
          )
        )
      )
    } catch {
      load()
    }
  }

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{t('nav.backlog')}</h1>
        <form onSubmit={addIdea} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New idea..."
            className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)] w-52"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="bg-[var(--accent)] text-white text-sm font-medium px-3 py-2 rounded-[var(--radius-md)] disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            + Add
          </button>
        </form>
      </div>

      <div className="overflow-x-auto pb-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map(({ status, label }) => (
              <BacklogColumn
                key={status}
                status={status}
                label={label}
                items={board[status] ?? []}
                onVote={vote}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}
