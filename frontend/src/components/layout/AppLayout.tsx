import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import Sidebar from './Sidebar'
import Header from './Header'

// Toggle: set to true to skip login for demos.
// All auth code is preserved — flip back to false to re-enable.
const BYPASS_AUTH = true

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (!BYPASS_AUTH && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-[var(--text-secondary)] text-sm">Загрузка...</div>
      </div>
    )
  }

  if (!BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-[var(--bg-main)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
