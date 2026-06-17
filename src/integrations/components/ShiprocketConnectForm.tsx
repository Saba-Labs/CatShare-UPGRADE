export function ShiprocketConnectForm({
  email,
  password,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: {
  email: string;
  password: string;
  loading?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="int-card" style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
        Shiprocket API credentials
      </h2>
      <p style={{ fontSize: 12, color: 'var(--int-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Use the API user from Shiprocket → Settings → API (not your main login email).
      </p>
      <label className="int-field-label" htmlFor="sr-api-email">
        API user email
      </label>
      <input
        id="sr-api-email"
        className="int-field-input"
        type="email"
        autoComplete="username"
        value={email}
        disabled={loading}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="api-user@example.com"
      />
      <label className="int-field-label" htmlFor="sr-api-password" style={{ marginTop: 10 }}>
        API user password
      </label>
      <input
        id="sr-api-password"
        className="int-field-input"
        type="password"
        autoComplete="current-password"
        value={password}
        disabled={loading}
        onChange={(e) => onPasswordChange(e.target.value)}
        placeholder="Password from Shiprocket email"
      />
      <button
        type="button"
        className="int-btn int-btn-primary"
        style={{ marginTop: 14 }}
        disabled={loading || !email.trim() || !password}
        onClick={onSubmit}
      >
        {loading ? 'Connecting…' : 'Connect Shiprocket'}
      </button>
    </div>
  );
}
