import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import i18n from '../../i18n/index'

export default function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru'
    i18n.changeLanguage(next)
    localStorage.setItem('idev_crm_lang', next)
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-end px-6 gap-4 shrink-0">
      <button
        onClick={toggleLang}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] font-medium px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
      >
        {i18n.language === 'ru' ? 'EN' : 'RU'}
      </button>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-secondary)]">{user?.full_name}</span>
        <button
          onClick={logout}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
        >
          {t('auth.logout')}
        </button>
      </div>
    </header>
  )
}
