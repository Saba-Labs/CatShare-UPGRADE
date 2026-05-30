import type { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Hide description text — full text still available via header tooltip when provided. */
  compact?: boolean;
}

/** Grouped card block for the builder right sidebar */
export default function SidebarSection({
  title,
  description,
  icon,
  action,
  children,
  className = '',
  compact = true,
}: SidebarSectionProps) {
  const tooltip = description ? `${title} — ${description}` : title;

  return (
    <section className={`sidebar-card${className ? ` ${className}` : ''}`}>
      <div className="sidebar-card__header" title={tooltip}>
        <div className="sidebar-card__header-text">
          {icon ? <span className="sidebar-card__icon">{icon}</span> : null}
          <h4 className="sidebar-card__title">{title}</h4>
          {!compact && description ? <p className="sidebar-card__desc">{description}</p> : null}
        </div>
        {action ? <div className="sidebar-card__action">{action}</div> : null}
      </div>
      <div className="sidebar-card__body">{children}</div>
    </section>
  );
}
