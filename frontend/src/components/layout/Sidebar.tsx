import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const navItems = [
  { to: '/dashboard', icon: '📊', key: 'nav.dashboard' },
  { to: '/clients',   icon: '🏢', key: 'nav.clients' },
  { to: '/deals',     icon: '🤝', key: 'nav.deals' },
  { to: '/tasks',     icon: '✅', key: 'nav.tasks' },
  { to: '/chat',      icon: '💬', key: 'nav.chat' },
  { to: '/reports',   icon: '📈', key: 'nav.reports' },
  { to: '/backlog',   icon: '💡', key: 'nav.backlog' },
  { to: '/settings',  icon: '⚙️', key: 'nav.settings' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <span className="font-bold text-lg text-[var(--accent)]">iDev CRM</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors
               ${isActive
                 ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                 : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
               }`
            }
          >
            <span>{icon}</span>
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
