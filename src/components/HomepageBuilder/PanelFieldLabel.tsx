import { FiInfo } from 'react-icons/fi';

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
      {hint ? (
        <button
          type="button"
          className="panel-label-info"
          title={hint}
          aria-label={hint}
          onClick={(e) => e.stopPropagation()}
        >
          <FiInfo aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

interface SidebarPanelHeadingProps {
  title: string;
  hint?: string;
}

export function SidebarPanelHeading({ title, hint }: SidebarPanelHeadingProps) {
  return (
    <div className="sidebar-panel-header sidebar-panel-header--with-hint">
      <h3>{title}</h3>
      {hint ? (
        <button
          type="button"
          className="panel-label-info"
          title={hint}
          aria-label={hint}
          onClick={(e) => e.stopPropagation()}
        >
          <FiInfo aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
