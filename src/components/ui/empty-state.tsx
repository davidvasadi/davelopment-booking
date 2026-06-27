import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/[0.06]">
          <Icon className="h-5 w-5 text-zinc-400 dark:text-white/30" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-semibold text-zinc-700 dark:text-white/60">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-white/30 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
