import type { ReactNode } from 'react';
import { FiInfo } from 'react-icons/fi';

function PanelInfoButton({ hint }: { hint: string }) {
  return (
    <button
      type="button"
      className="panel-label-info"
      title={hint}
      aria-label={hint}
      onClick={(e) => e.stopPropagation()}
    >
      <FiInfo aria-hidden />
    </button>
  );
}

interface PanelFieldLabelProps {
  label: string;
  hint?: string;
  htmlFor?: string;
}

export default function PanelFieldLabel({ label, hint, htmlFor }: PanelFieldLabelProps) {
  return (
    <div className="panel-label-row">
      <label className="panel-label" htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? <PanelInfoButton hint={hint} /> : null}
    </div>
  );
}

interface SidebarPanelHeadingProps {
  title: string;
  hint?: string;
  actions?: ReactNode;
}

export function SidebarPanelHeading({ title, hint, actions }: SidebarPanelHeadingProps) {
  return (
    <div className="sidebar-panel-header">
      <div className={`sidebar-panel-header__lead${hint ? ' sidebar-panel-header__lead--with-hint' : ''}`}>
        <h3>{title}</h3>
        {hint ? <PanelInfoButton hint={hint} /> : null}
      </div>
      {actions ? <div className="sidebar-panel-header__actions">{actions}</div> : null}
    </div>
  );
}
