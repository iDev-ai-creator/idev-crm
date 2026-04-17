import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import DealsPage from './pages/DealsPage'
import DealDetailPage from './pages/DealDetailPage'
import TasksPage from './pages/TasksPage'
import KPIPage from './pages/KPIPage'
import ChatPage from './pages/ChatPage'
import BacklogPage from './pages/BacklogPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/CalendarPage'
import GlobalSearchPage from './pages/GlobalSearchPage'
import BenchPage from './pages/BenchPage'

function AuthInit({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  useEffect(() => { fetchMe() }, [fetchMe])
  return <>{children}</>
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-4">{title}</h1>
      <p className="text-sm text-[var(--text-secondary)]">Coming soon — Phase 3/4.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/kpi" element={<KPIPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/search" element={<GlobalSearchPage />} />
            <Route path="/bench" element={<BenchPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/backlog" element={<BacklogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthInit>
    </BrowserRouter>
  )
}
