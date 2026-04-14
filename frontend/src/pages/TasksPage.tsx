import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { tasksApi, type Task, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS } from '../api/tasks'

const STATUS_OPTIONS = ['', 'todo', 'in_progress', 'done'] as const
const PRIORITY_OPTIONS = ['', 'low', 'medium', 'high', 'urgent'] as const

export default function TasksPage() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      const data = await tasksApi.list(params)
      setTasks(data.results)
      setCount(data.count)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, priorityFilter])

  const toggleStatus = async (task: Task) => {
    const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo'
    const updated = await tasksApi.update(task.id, { status: next })
    setTasks(tasks.map((t) => t.id === task.id ? updated : t))
  }

  const STATUS_DOT = { todo: 'bg-[var(--border)]', in_progress: 'bg-[var(--warning)]', done: 'bg-[var(--success)]' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {t('nav.tasks')} <span className="text-[var(--text-secondary)] text-lg font-normal">({count})</span>
        </h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
      ) : tasks.length === 0 ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.noData')}</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-[var(--bg-card)] rounded-[var(--radius-lg)] p-4 border flex items-start gap-4 transition-colors
                ${task.is_overdue ? 'border-[var(--danger)]/40' : 'border-[var(--border)]'}`}
            >
              {/* Status toggle */}
              <button
                onClick={() => toggleStatus(task)}
                title={`Status: ${STATUS_LABELS[task.status]} — click to advance`}
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors
                  ${task.status === 'done' ? 'bg-[var(--success)] border-[var(--success)]' : 'border-[var(--border)] hover:border-[var(--accent)]'}`}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text)]'}`}>
                    {task.title}
                  </span>
                  <span className={`text-xs font-medium flex-shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                    {STATUS_LABELS[task.status]}
                  </span>
                  {task.assigned_to && (
                    <span className="text-xs text-[var(--text-secondary)]">{task.assigned_to.full_name}</span>
                  )}
                  {task.deadline && (
                    <span className={`text-xs ${task.is_overdue ? 'text-[var(--danger)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                      {task.is_overdue ? '⚠ ' : ''}
                      {new Date(task.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
