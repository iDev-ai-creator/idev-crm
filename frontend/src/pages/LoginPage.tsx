import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input } from 'idev-ui'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      navigate('/dashboard')
    } catch {
      setError(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
      <div className="w-full max-w-sm bg-[var(--bg-card)] rounded-[20px] shadow-[var(--shadow-md)] p-8">
        <div className="mb-8 text-center">
          <span className="font-bold text-2xl text-[var(--accent)]">
            iDev CRM
          </span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text)] mb-6 text-center">
          {t('auth.loginTitle')}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <p className="text-sm text-[var(--danger)] text-center">{error}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            loading={loading}
          >
            {t('auth.login')}
          </Button>
        </form>
      </div>
    </div>
  )
}
