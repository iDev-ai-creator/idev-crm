import { NavLink, useLocation } from 'react-router-dom'
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

interface Props {
  onClose?: () => void
}

export default function Sidebar({ onClose }: Props) {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <aside className="w-64 h-screen bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col shadow-lg md:shadow-none">
      {/* Logo + close button */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <span className="font-bold text-xl text-[var(--accent)]">iDev CRM</span>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] text-lg"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(({ to, icon, key }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all
                ${isActive
                  ? 'text-[var(--accent)] bg-[var(--accent)]/10 border-r-2 border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }
              `}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span>{t(key)}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
