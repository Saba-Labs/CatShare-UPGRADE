import type { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Grouped card block for the builder right sidebar */
export default function SidebarSection({
  title,
  description,
  action,
  children,
  className = '',
}: SidebarSectionProps) {
  return (
    <section className={`sidebar-card${className ? ` ${className}` : ''}`}>
      <div className="sidebar-card__header">
        <div className="sidebar-card__header-text">
          <h4 className="sidebar-card__title">{title}</h4>
          {description ? <p className="sidebar-card__desc">{description}</p> : null}
        </div>
        {action ? <div className="sidebar-card__action">{action}</div> : null}
      </div>
      <div className="sidebar-card__body">{children}</div>
    </section>
  );
}
