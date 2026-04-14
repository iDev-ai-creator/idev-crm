import api from './client'

export interface Contact {
  id: number
  client: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  position: string
  linkedin: string
  is_primary: boolean
  language_pref: 'ru' | 'en'
  notes: string
  created_at: string
}

export interface Client {
  id: number
  name: string
  industry: string
  website: string
  country: string
  company_size: string
  status: 'lead' | 'prospect' | 'active' | 'paused' | 'churned'
  tech_stack: string[]
  budget_range: string
  description: string
  assigned_to: { id: number; full_name: string; email: string } | null
  created_by: { id: number; full_name: string; email: string } | null
  contacts: Contact[]
  contacts_count: number
  created_at: string
  updated_at: string
}

export interface ClientListItem {
  id: number
  name: string
  industry: string
  status: Client['status']
  company_size: string
  budget_range: string
  assigned_to: { id: number; full_name: string } | null
  contacts_count: number
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const clientsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<ClientListItem>> => {
    const { data } = await api.get('/clients/', { params })
    return data
  },
  get: async (id: number): Promise<Client> => {
    const { data } = await api.get(`/clients/${id}/`)
    return data
  },
  create: async (payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.post('/clients/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.patch(`/clients/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/clients/${id}/`) },
  contacts: {
    list: async (clientId: number): Promise<Contact[]> => {
      const { data } = await api.get(`/clients/${clientId}/contacts/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    create: async (clientId: number, payload: Partial<Contact>): Promise<Contact> => {
      const { data } = await api.post(`/clients/${clientId}/contacts/`, payload)
      return data
    },
    update: async (clientId: number, contactId: number, payload: Partial<Contact>): Promise<Contact> => {
      const { data } = await api.patch(`/clients/${clientId}/contacts/${contactId}/`, payload)
      return data
    },
    delete: async (clientId: number, contactId: number): Promise<void> => {
      await api.delete(`/clients/${clientId}/contacts/${contactId}/`)
    },
  },
}
