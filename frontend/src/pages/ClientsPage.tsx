import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clientsApi, type ClientListItem } from '../api/clients'
import ClientStatusBadge from '../components/clients/ClientStatusBadge'

export default function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q) params.search = q
      const data = await clientsApi.list(params)
      setClients(data.results)
      setCount(data.count)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {t('nav.clients')}
          <span className="ml-2 text-[var(--text-secondary)] text-lg font-normal">({count})</span>
        </h1>
        <button
          onClick={() => navigate('/clients/new')}
          className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
        >
          + {t('common.add')}
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder={t('common.search') + '...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="border border-[var(--border)] text-[var(--text)] text-sm px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          {t('common.search')}
        </button>
      </form>

      {loading ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
      ) : clients.length === 0 ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.noData')}</div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] overflow-hidden border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Company', 'Industry', 'Status', 'Manager', 'Contacts', 'Created'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-[var(--text-secondary)] px-4 py-3 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/clients/${client.id}`} className="font-medium text-sm text-[var(--accent)] hover:underline">
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{client.industry || '—'}</td>
                  <td className="px-4 py-3"><ClientStatusBadge status={client.status} /></td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{client.assigned_to?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{client.contacts_count}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
