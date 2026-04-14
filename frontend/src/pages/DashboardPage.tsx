import { useTranslation } from 'react-i18next'

export default function DashboardPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-4">
        {t('nav.dashboard')}
      </h1>
      <p className="text-[var(--text-secondary)] text-sm">Coming in Phase 3.</p>
    </div>
  )
}
