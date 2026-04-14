import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dashboardApi, type DashboardStats } from '../api/dashboard'
import { useAuthStore } from '../stores/authStore'

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-5 border ${accent ? 'border-[var(--accent)]/30' : 'border-[var(--border)]'}`}>
      <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-bold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{value}</div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

const FUNNEL_COLORS = ['#94a3b8', '#60a5fa', '#a78bfa', '#f59e0b', '#34d399', '#fd7448']

export default function DashboardPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.stats().then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
  if (!stats) return <div className="text-[var(--danger)] text-sm">Failed to load dashboard</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{t('nav.dashboard')}</h1>
        {user && <p className="text-sm text-[var(--text-secondary)] mt-1">Welcome back, {user.first_name}</p>}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Active Clients" value={stats.clients.active} sub={`${stats.clients.new_30d} new this month`} />
        <KpiCard label="Pipeline Value" value={`$${(stats.deals.pipeline_value_usd / 1000).toFixed(0)}K`} sub={`${stats.deals.active} active deals`} accent />
        <KpiCard label="My Open Tasks" value={stats.tasks.my_open} sub={stats.tasks.overdue > 0 ? `${stats.tasks.overdue} overdue` : 'All on track'} />
        <KpiCard label="Total Deals" value={stats.deals.total} sub={`${stats.clients.total} clients total`} />
      </div>

      {/* Funnel chart */}
      <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-6 border border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide mb-4">Sales Funnel</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.funnel} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
              itemStyle={{ color: 'var(--text-secondary)' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {stats.funnel.map((_, i) => (
                <Cell key={`cell-${i}`} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
