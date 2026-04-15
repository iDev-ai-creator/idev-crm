import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import type { UserProfile } from '../api/auth'

interface Role {
  id: number
  name: string
  preset: string
  can_manage_users: boolean
  can_manage_deals: boolean
  can_manage_clients: boolean
  can_view_reports: boolean
  can_manage_settings: boolean
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/users/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
      api.get('/users/roles/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
    ]).then(([u, r]) => {
      setUsers(u)
      setRoles(r)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>

  const PERM_LABELS: Record<string, string> = {
    can_manage_users: 'Users',
    can_manage_deals: 'Deals',
    can_manage_clients: 'Clients',
    can_view_reports: 'Reports',
    can_manage_settings: 'Settings',
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--text)]">{t('nav.settings')}</h1>

      {/* Roles */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          Roles & Permissions
        </h2>
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-[var(--text)]">{role.name}</span>
                <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{role.preset}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => (
                  <span
                    key={key}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      role[key as keyof Role]
                        ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30'
                        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]'
                    }`}
                  >
                    {role[key as keyof Role] ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          Team Members ({users.length})
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No users yet.</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--text)]">{u.full_name || u.email}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {u.role && (
                    <span className="text-xs bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded-full border border-[var(--accent)]/20">
                      {u.role.name}
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} title={u.is_active ? 'Active' : 'Inactive'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System info */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          System
        </h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Version</span>
            <span className="text-[var(--text)] font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Stack</span>
            <span className="text-[var(--text)]">Django 5 + React 19</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Auth mode</span>
            <span className="text-[var(--warning)] font-medium">⚠ Demo (bypass)</span>
          </div>
        </div>
      </section>
    </div>
  )
}
