import { useState, useEffect, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { dealsApi, type Deal, DEAL_STATUSES, DEAL_STATUS_LABELS } from '../api/deals'
import KanbanColumn from '../components/deals/KanbanColumn'

type Board = Record<string, Deal[]>

export default function DealsPage() {
  const { t } = useTranslation()
  const [board, setBoard] = useState<Board>({})
  const [loading, setLoading] = useState(true)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await dealsApi.list({ page_size: '200' })
      const grouped: Board = {}
      DEAL_STATUSES.forEach((s) => { grouped[s] = [] })
      data.results.forEach((d) => { (grouped[d.status] ??= []).push(d) })
      Object.keys(grouped).forEach((s) => { grouped[s].sort((a, b) => a.order - b.order) })
      setBoard(grouped)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const overId = String(over.id)

    let fromStatus = ''
    for (const [s, deals] of Object.entries(board)) {
      if (deals.find((d) => d.id === activeId)) { fromStatus = s; break }
    }
    if (!fromStatus) return

    const toStatus = DEAL_STATUSES.includes(overId as Deal['status'])
      ? overId
      : (() => {
          for (const [s, deals] of Object.entries(board)) {
            if (deals.find((d) => d.id === Number(overId))) return s
          }
          return fromStatus
        })()

    const newBoard = { ...board }
    if (fromStatus === toStatus) {
      const col = [...newBoard[fromStatus]]
      const oi = col.findIndex((d) => d.id === activeId)
      const ni = col.findIndex((d) => d.id === Number(overId))
      if (oi === ni) return
      newBoard[fromStatus] = arrayMove(col, oi, ni)
    } else {
      const moving = { ...newBoard[fromStatus].find((d) => d.id === activeId)!, status: toStatus as Deal['status'] }
      newBoard[fromStatus] = newBoard[fromStatus].filter((d) => d.id !== activeId)
      const toCol = [...(newBoard[toStatus] ?? [])]
      const insertAt = toCol.findIndex((d) => d.id === Number(overId))
      insertAt >= 0 ? toCol.splice(insertAt, 0, moving) : toCol.push(moving)
      newBoard[toStatus] = toCol
    }
    setBoard(newBoard)

    try {
      if (fromStatus !== toStatus) await dealsApi.update(activeId, { status: toStatus as Deal['status'] })
      const reorder = newBoard[toStatus].map((d, i) => ({ id: d.id, order: i }))
      await dealsApi.reorder(reorder)
    } catch { load() }
  }

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-6">{t('nav.deals')}</h1>
      <div className="overflow-x-auto pb-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 min-w-max">
            {DEAL_STATUSES.map((status) => (
              <KanbanColumn key={status} status={status} label={DEAL_STATUS_LABELS[status]} deals={board[status] ?? []} />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}
