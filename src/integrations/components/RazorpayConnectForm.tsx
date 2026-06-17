export function RazorpayConnectForm({
  keyId,
  keySecret,
  loading,
  onKeyIdChange,
  onKeySecretChange,
  onSubmit,
}: {
  keyId: string;
  keySecret: string;
  loading?: boolean;
  onKeyIdChange: (value: string) => void;
  onKeySecretChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="int-card" style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        Razorpay API credentials
      </h2>
      <p
        style={{
          fontSize: 12,
          color: 'var(--int-muted)',
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        Use API Key ID and Key Secret from Razorpay Dashboard {'>'} Settings {'>'} API Keys.
      </p>

      <label className="int-field-label" htmlFor="rzp-key-id">
        Key ID
      </label>
      <input
        id="rzp-key-id"
        className="int-field-input"
        type="text"
        autoComplete="username"
        value={keyId}
        disabled={loading}
        onChange={(e) => onKeyIdChange(e.target.value)}
        placeholder="rzp_live_xxxxx"
      />

      <label className="int-field-label" htmlFor="rzp-key-secret" style={{ marginTop: 10 }}>
        Key Secret
      </label>
      <input
        id="rzp-key-secret"
        className="int-field-input"
        type="password"
        autoComplete="current-password"
        value={keySecret}
        disabled={loading}
        onChange={(e) => onKeySecretChange(e.target.value)}
        placeholder="Razorpay key secret"
      />

      <button
        type="button"
        className="int-btn int-btn-primary"
        style={{ marginTop: 14 }}
        disabled={loading || !keyId.trim() || !keySecret}
        onClick={onSubmit}
      >
        {loading ? 'Connecting…' : 'Connect Razorpay'}
      </button>
    </div>
  );
}
