import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

interface BacklogItem {
  id: number
  title: string
  description: string
  status: 'idea' | 'in_progress' | 'testing' | 'done'
  author: { id: number; full_name: string } | null
  votes: number
  comments_count: number
  created_at: string
}

const COLUMNS = [
  { status: 'idea' as const, label: '💡 Ideas' },
  { status: 'in_progress' as const, label: '🔧 In Progress' },
  { status: 'testing' as const, label: '🧪 Testing' },
  { status: 'done' as const, label: '✅ Done' },
]

export default function BacklogPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const { data } = await api.get('/backlog/?page_size=100')
    setItems(Array.isArray(data) ? data : data.results ?? [])
  }

  useEffect(() => { load().finally(() => setLoading(false)) }, [])

  const vote = async (id: number) => {
    await api.post(`/backlog/${id}/vote/`)
    setItems(items.map((i) => i.id === id ? { ...i, votes: i.votes + 1 } : i))
  }

  const addIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const { data } = await api.post('/backlog/', { title: newTitle.trim(), status: 'idea' })
      setItems([data, ...items])
      setNewTitle('')
    } finally { setAdding(false) }
  }

  const moveStatus = async (item: BacklogItem, newStatus: BacklogItem['status']) => {
    await api.patch(`/backlog/${item.id}/`, { status: newStatus })
    setItems(items.map((i) => i.id === item.id ? { ...i, status: newStatus } : i))
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ status, label }) => {
          const colItems = items.filter((i) => i.status === status)
          return (
            <div key={status} className="flex-shrink-0 w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text)]">{label}</h3>
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{colItems.length}</span>
              </div>
              <div className="space-y-2">
                {colItems.map((item) => (
                  <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-3 hover:border-[var(--accent)]/40 transition-colors">
                    <p className="text-sm font-medium text-[var(--text)] mb-1">{item.title}</p>
                    {item.description && <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center justify-between">
                      <button onClick={() => vote(item.id)} className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                        👍 {item.votes}
                      </button>
                      <select
                        value={status}
                        onChange={(e) => moveStatus(item, e.target.value as BacklogItem['status'])}
                        className="text-xs border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] rounded px-1 py-0.5 focus:outline-none"
                      >
                        {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
