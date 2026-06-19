import { useState, type FormEvent } from 'react';
import { FiLock } from 'react-icons/fi';
import { verifyStorePassword } from '../../services/storeSecurityService';
import { setStorePasswordUnlocked } from '../../utils/storePasswordAccess';

type StorePasswordGateProps = {
  storeSlug: string;
  storeName: string;
  onUnlocked: () => void;
};

export default function StorePasswordGate({
  storeSlug,
  storeName,
  onUnlocked,
}: StorePasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Please enter the store password.');
      return;
    }

    setSubmitting(true);
    setError('');
    const result = await verifyStorePassword(storeSlug, trimmed);
    setSubmitting(false);

    if (!result.ok) {
      const msg = String((result.error as { message?: string })?.message ?? '');
      if (msg.includes('verify_store_password') || msg.includes('function')) {
        setError('Password check is unavailable. Ask the seller to run the latest store security SQL.');
      } else {
        setError('Incorrect password. Please try again.');
      }
      return;
    }

    setStorePasswordUnlocked(storeSlug);
    onUnlocked();
  };

  return (
    <div className="sv sv-fullscreen">
      <div className="sv-error-card" style={{ maxWidth: 420 }}>
        <div className="sv-error-stripe" style={{ background: 'linear-gradient(90deg,#6366f1,#4f46e5)' }} />
        <div className="sv-error-body">
          <div className="sv-error-icon" style={{ color: '#4f46e5' }}>
            <FiLock size={28} />
          </div>
          <div className="sv-error-title">Password required</div>
          <div className="sv-offline-desc" style={{ marginBottom: 16 }}>
            {storeName} is password protected. Enter the password to continue shopping.
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ width: '100%', maxWidth: 320, margin: '0 auto' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Store password"
              autoComplete="current-password"
              className="w-full px-4 py-3 mb-2 border border-gray-300 rounded-xl text-sm"
              disabled={submitting}
            />
            {error ? (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10, textAlign: 'left' }}>{error}</p>
            ) : null}
            <button type="submit" className="sv-error-btn" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Checking…' : 'Enter store'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
