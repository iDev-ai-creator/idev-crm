import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import i18n from '../../i18n/index'

interface Props {
  onMenuClick: () => void
  sidebarOpen: boolean
}

export default function Header({ onMenuClick, sidebarOpen }: Props) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru'
    i18n.changeLanguage(next)
    localStorage.setItem('idev_crm_lang', next)
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center px-4 gap-3 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={toggleLang}
          className="text-xs md:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)]"
        >
          {i18n.language === 'ru' ? 'EN' : 'RU'}
        </button>

        <div className="flex items-center gap-2 md:gap-3">
          {user && (
            <span className="hidden sm:block text-sm text-[var(--text-secondary)] max-w-[120px] truncate">
              {user.full_name || user.email}
            </span>
          )}
          <button
            onClick={logout}
            className="text-xs md:text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors whitespace-nowrap"
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </header>
  )
}
