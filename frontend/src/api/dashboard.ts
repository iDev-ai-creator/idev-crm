import api from './client'

export interface DashboardStats {
  clients: { total: number; active: number; new_30d: number }
  deals: { total: number; active: number; pipeline_value_usd: number }
  funnel: { status: string; label: string; count: number }[]
  tasks: { my_open: number; overdue: number }
}

export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats/')
    return data
  },
}
