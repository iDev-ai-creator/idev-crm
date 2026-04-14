import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clientsApi, type Client, type Contact } from '../api/clients'
import ClientStatusBadge from '../components/clients/ClientStatusBadge'

type Tab = 'info' | 'contacts' | 'deals'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('info')

  useEffect(() => {
    if (!id) return
    clientsApi.get(Number(id)).then(setClient).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
  if (!client) return <div className="text-[var(--danger)] p-4">Client not found</div>

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'info', label: 'Info' },
    { key: 'contacts', label: 'Contacts', count: client.contacts_count },
    { key: 'deals', label: 'Deals' },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/clients')}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] mb-2 block"
          >
            ← {t('nav.clients')}
          </button>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{client.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <ClientStatusBadge status={client.status} />
            {client.industry && <span className="text-sm text-[var(--text-secondary)]">{client.industry}</span>}
            {client.assigned_to && (
              <span className="text-sm text-[var(--text-secondary)]">Manager: {client.assigned_to.full_name}</span>
            )}
          </div>
        </div>
        <button className="border border-[var(--border)] text-[var(--text)] text-sm px-4 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-hover)] transition-colors">
          {t('common.edit')}
        </button>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === tab.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'info' && <InfoTab client={client} />}
      {activeTab === 'contacts' && <ContactsTab contacts={client.contacts} />}
      {activeTab === 'deals' && (
        <div className="text-sm text-[var(--text-secondary)]">
          <Link to={`/deals?client=${client.id}`} className="text-[var(--accent)] hover:underline">
            View deals for {client.name} →
          </Link>
        </div>
      )}
    </div>
  )
}

function InfoTab({ client }: { client: Client }) {
  const fields = [
    { label: 'Website', value: client.website ? <a href={client.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">{client.website}</a> : '—' },
    { label: 'Country', value: client.country || '—' },
    { label: 'Company size', value: client.company_size || '—' },
    { label: 'Budget range', value: client.budget_range || '—' },
    { label: 'Tech stack', value: client.tech_stack?.length ? client.tech_stack.join(', ') : '—' },
    { label: 'Description', value: client.description || '—' },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
      {fields.map(({ label, value }) => (
        <div key={label} className="bg-[var(--bg-card)] rounded-[var(--radius-md)] p-4 border border-[var(--border)]">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">{label}</div>
          <div className="text-sm text-[var(--text)]">{value}</div>
        </div>
      ))}
    </div>
  )
}

function ContactsTab({ contacts }: { contacts: Contact[] }) {
  if (!contacts.length) return <div className="text-sm text-[var(--text-secondary)]">No contacts yet.</div>
  return (
    <div className="space-y-3 max-w-2xl">
      {contacts.map((c) => (
        <div key={c.id} className="bg-[var(--bg-card)] rounded-[var(--radius-md)] p-4 border border-[var(--border)]">
          <div className="font-medium text-sm text-[var(--text)]">
            {c.full_name}
            {c.is_primary && <span className="ml-2 text-xs text-[var(--accent)]">● Primary</span>}
          </div>
          {c.position && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{c.position}</div>}
          {c.email && <div className="text-xs text-[var(--text-secondary)]">{c.email}</div>}
        </div>
      ))}
    </div>
  )
}
