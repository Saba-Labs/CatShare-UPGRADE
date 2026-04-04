import { useNavigate } from 'react-router-dom';

export default function Store() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#F8FAFC',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        position: 'relative',
      }}
    >
      {/* Status bar */}
      <div style={{ position: 'fixed', inset: '0 0 auto 0', height: 40, background: '#0F172A', zIndex: 50 }} />

      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 40,
        zIndex: 40,
        background: '#fff',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: 52,
        }}>
          <div style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.4px',
          }}>
            Store
          </div>
        </div>
      </div>

      {/* Content */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 70,
        paddingTop: 50,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60%',
          gap: 12,
          padding: 24,
        }}>
          <div style={{ fontSize: 36, marginBottom: 4 }}>🏪</div>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#374151',
            textAlign: 'center',
          }}>
            Store Coming Soon
          </div>
          <div style={{
            fontSize: 13,
            color: '#94A3B8',
            textAlign: 'center',
            maxWidth: 300,
          }}>
            Manage your product catalog and store settings here
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: 14,
        fontWeight: 500,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: '#fff',
        borderTop: '1px solid #E2E8F0',
      }}>
        <button
          onClick={() => handleNavigate('/orders')}
          style={{
            flex: 1,
            padding: '14px 16px',
            textAlign: 'center',
            transition: 'all 0.15s',
            background: '#fff',
            color: '#4B5563',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F8FAFC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
          }}
        >
          Orders
        </button>
        <button
          onClick={() => handleNavigate('/store')}
          style={{
            flex: 1,
            padding: '14px 16px',
            textAlign: 'center',
            transition: 'all 0.15s',
            background: '#2563EB',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Store
        </button>
      </nav>
    </div>
  );
}
