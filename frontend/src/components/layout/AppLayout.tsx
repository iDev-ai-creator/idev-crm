import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore, BYPASS_AUTH } from '../../stores/authStore'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [window.location.pathname])

  if (!BYPASS_AUTH && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-[var(--text-secondary)] text-sm animate-pulse">Загрузка...</div>
      </div>
    )
  }

  if (!BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-[var(--bg-main)] overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <div
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(s => !s)} sidebarOpen={sidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
