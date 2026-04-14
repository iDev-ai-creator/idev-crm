import api from './client'
import type { PaginatedResponse } from './clients'

export interface DealNote {
  id: number
  deal: number
  author: { id: number; full_name: string; email: string } | null
  text: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Deal {
  id: number
  title: string
  client: { id: number; name: string; status: string } | null
  client_id?: number
  assigned_to: { id: number; full_name: string } | null
  assigned_to_id?: number
  created_by: { id: number; full_name: string } | null
  status: 'new_lead' | 'discovery' | 'proposal' | 'negotiation' | 'signed' | 'active' | 'closed' | 'lost'
  value_usd: string
  probability: number
  team_size_needed: number
  tech_requirements: string[]
  start_date: string | null
  end_date: string | null
  expected_close_date: string | null
  description: string
  order: number
  notes_count: number
  created_at: string
  updated_at: string
}

export const DEAL_STATUSES: Deal['status'][] = [
  'new_lead', 'discovery', 'proposal', 'negotiation', 'signed', 'active', 'closed', 'lost',
]

export const DEAL_STATUS_LABELS: Record<Deal['status'], string> = {
  new_lead: 'New Lead', discovery: 'Discovery', proposal: 'Proposal',
  negotiation: 'Negotiation', signed: 'Signed', active: 'Active',
  closed: 'Closed', lost: 'Lost',
}

export const dealsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Deal>> => {
    const { data } = await api.get('/deals/', { params })
    return data
  },
  get: async (id: number): Promise<Deal> => {
    const { data } = await api.get(`/deals/${id}/`)
    return data
  },
  create: async (payload: Record<string, unknown>): Promise<Deal> => {
    const { data } = await api.post('/deals/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Deal>): Promise<Deal> => {
    const { data } = await api.patch(`/deals/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/deals/${id}/`) },
  reorder: async (items: { id: number; order: number }[]): Promise<void> => {
    await api.post('/deals/reorder/', items)
  },
  notes: {
    list: async (dealId: number): Promise<DealNote[]> => {
      const { data } = await api.get(`/deals/${dealId}/notes/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    create: async (dealId: number, text: string): Promise<DealNote> => {
      const { data } = await api.post(`/deals/${dealId}/notes/`, { text })
      return data
    },
    update: async (dealId: number, noteId: number, text: string): Promise<DealNote> => {
      const { data } = await api.patch(`/deals/${dealId}/notes/${noteId}/`, { text })
      return data
    },
    delete: async (dealId: number, noteId: number): Promise<void> => {
      await api.delete(`/deals/${dealId}/notes/${noteId}/`)
    },
  },
}
