import type { LucideIcon } from 'lucide-react'
import { EmptyState as KitEmptyState } from '@/components/ui-kit'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Régi név, új kinézet: a kit üres állapota (csíkos felület, ikon fehér körben, cím, egy mondat, egy gomb). */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return <KitEmptyState icon={icon} title={title} action={action} className={className}>{description}</KitEmptyState>
}
