import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdOutlineHome } from 'react-icons/md';
function IconBack() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export interface WarehouseShellProps {
  title: string;
  subtitle?: string;
  backTo?: string | 'parent' | 'dashboard';
  rightSlot?: ReactNode;
  children?: ReactNode;
}

export default function WarehouseShell({
  title,
  subtitle,
  backTo = 'parent',
  rightSlot,
  children,
}: WarehouseShellProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo === 'dashboard') {
      navigate('/');
      return;
    }
    if (backTo === 'parent') {
      navigate('/warehouse');
      return;
    }
    navigate(backTo);
  };

  return (
    <>
      <div className="wh-status-bar" />
      <header className="wh-header">
        <button type="button" className="wh-back" aria-label="Back" onClick={handleBack}>
          <IconBack />
        </button>
        <div className="wh-title-block">
          <h1 className="wh-title">{title}</h1>
          {subtitle ? <p className="wh-subtitle">{subtitle}</p> : null}
        </div>
        {rightSlot ? (
          <div className="wh-header-right">{rightSlot}</div>
        ) : (
          <button
            type="button"
            className="wh-home"
            aria-label="Go to Home"
            title="Go to Home"
            onClick={() => navigate('/')}
          >
            <MdOutlineHome size={24} />
          </button>
        )}
      </header>
      <main className="wh-main">{children}</main>
    </>
  );
}
