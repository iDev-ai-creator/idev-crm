import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { dealsApi, type Deal, type DealNote, DEAL_STATUS_LABELS } from '../api/deals'

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [notes, setNotes] = useState<DealNote[]>([])
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    const dealId = Number(id)
    Promise.all([dealsApi.get(dealId), dealsApi.notes.list(dealId)])
      .then(([d, n]) => { setDeal(d); setNotes(n) })
      .finally(() => setLoading(false))
  }, [id])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim() || !deal) return
    setSubmitting(true)
    try {
      const note = await dealsApi.notes.create(deal.id, noteText.trim())
      setNotes([note, ...notes])
      setNoteText('')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (noteId: number) => {
    if (!deal) return
    await dealsApi.notes.delete(deal.id, noteId)
    setNotes(notes.filter((n) => n.id !== noteId))
  }

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
  if (!deal) return <div className="text-[var(--danger)] p-4">Deal not found</div>

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/deals')} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] mb-6 block">
        ← {t('nav.deals')}
      </button>

      <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-6 mb-6 border border-[var(--border)]">
        <h1 className="text-2xl font-semibold text-[var(--text)] mb-3">{deal.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
          <span>Status: <strong className="text-[var(--text)]">{DEAL_STATUS_LABELS[deal.status]}</strong></span>
          <span>Value: <strong className="text-[var(--accent)]">${Number(deal.value_usd).toLocaleString()}</strong></span>
          <span>Team: <strong className="text-[var(--text)]">{deal.team_size_needed} devs</strong></span>
          {deal.client && <span>Client: <strong className="text-[var(--text)]">{deal.client.name}</strong></span>}
          {deal.assigned_to && <span>Manager: <strong className="text-[var(--text)]">{deal.assigned_to.full_name}</strong></span>}
        </div>
        {deal.description && <p className="mt-4 text-sm text-[var(--text-secondary)] leading-relaxed">{deal.description}</p>}
      </div>

      <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-6 border border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Notes</h2>
        <form onSubmit={handleAddNote} className="mb-6">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={submitting || !noteText.trim()}
            className="mt-2 bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? '...' : 'Add Note'}
          </button>
        </form>

        <div className="space-y-3">
          {notes.length === 0 && <div className="text-sm text-[var(--text-secondary)]">No notes yet.</div>}
          {notes.map((note) => (
            <div key={note.id} className="border border-[var(--border)] rounded-[var(--radius-md)] p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-[var(--text-secondary)]">
                  {note.author?.full_name} · {new Date(note.created_at).toLocaleString()}
                </span>
                <button onClick={() => handleDelete(note.id)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors">
                  Delete
                </button>
              </div>
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{note.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
