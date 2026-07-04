interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl lg:text-[34px] font-light tracking-[-0.02em] text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  )
}
