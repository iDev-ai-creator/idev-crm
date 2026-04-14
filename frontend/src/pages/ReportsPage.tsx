import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dashboardApi, type DashboardStats } from '../api/dashboard'

const COLORS = ['#fd7448', '#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f87171', '#94a3b8', '#fb923c']

export default function ReportsPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { dashboardApi.stats().then(setStats).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
  if (!stats) return null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-6">{t('nav.reports')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Funnel bar chart */}
        <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-5 border border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4 uppercase tracking-wide">Sales Funnel</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.funnel}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stats.funnel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats */}
        <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-5 border border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4 uppercase tracking-wide">Summary</h2>
          <div className="space-y-3">
            {[
              { label: 'Total Clients', value: stats.clients.total },
              { label: 'Active Clients', value: stats.clients.active },
              { label: 'New Clients (30d)', value: stats.clients.new_30d },
              { label: 'Total Deals', value: stats.deals.total },
              { label: 'Active Deals', value: stats.deals.active },
              { label: 'Pipeline Value', value: `$${stats.deals.pipeline_value_usd.toLocaleString()}` },
              { label: 'Overdue Tasks', value: stats.tasks.overdue },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--border)]/50 last:border-0">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-semibold text-[var(--text)]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
