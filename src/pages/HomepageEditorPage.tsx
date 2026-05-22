import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useState } from 'react';
import { getSellerStore, type Store } from '../services/storeService';
import HomepageBuilder from '../components/HomepageBuilder/HomepageBuilder';

export default function HomepageEditorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStore = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await getSellerStore(user.uid);
        if (result.success && result.data) {
          setStore(result.data);
        } else {
          showToast('Store not found. Please create a store first.', 'error');
          navigate('/store');
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load store';
        showToast(msg, 'error');
        navigate('/store');
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [user?.uid, navigate, showToast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>Loading...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!store) {
    return null;
  }

  return (
    <HomepageBuilder
      storeId={store.id}
      onClose={() => navigate('/store')}
    />
  );
}
