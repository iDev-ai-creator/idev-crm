import { Badge } from 'idev-ui'

const STATUS_CONFIG = {
  lead: { color: 'blue' as const, label: 'Lead' },
  prospect: { color: 'yellow' as const, label: 'Prospect' },
  active: { color: 'green' as const, label: 'Active' },
  paused: { color: 'gray' as const, label: 'Paused' },
  churned: { color: 'red' as const, label: 'Churned' },
} as const

export default function ClientStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!config) return <span>{status}</span>
  return <Badge color={config.color}>{config.label}</Badge>
}
