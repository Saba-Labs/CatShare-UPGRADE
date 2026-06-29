/** Shared scoped CSS for integration store sub-pages (DM Sans, matches Store checkout/custom domain). */
export const INTEGRATIONS_PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');

  :where(.int-root) *, :where(.int-root) *::before, :where(.int-root) *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --int-bg: rgb(224, 238, 243);
    --int-card: #FFFFFF;
    --int-border: #E2E8F0;
    --int-text: #0F172A;
    --int-muted: #64748B;
    --int-faint: #94A3B8;
    --int-accent: #2563EB;
    --int-green: #1A7A4A;
    --int-green-bg: #F0FAF5;
    --int-green-border: #C3E8D5;
    --int-amber-bg: #FDF8EE;
    --int-amber-border: #F0E4C8;
    --int-amber: #92641A;
    --int-red: #C0392B;
    --int-red-bg: #FDF4F3;
    --int-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04);
    --int-radius: 16px;
    --int-radius-sm: 10px;
    --int-font: 'DM Sans', system-ui, sans-serif;
    --int-mono: 'DM Mono', Menlo, monospace;
  }

  .int-root {
    min-height: 100dvh;
    background: var(--int-bg);
    font-family: var(--int-font);
    display: flex;
    flex-direction: column;
    padding-top: 40px;
    padding-bottom: 72px;
    color: var(--int-text);
  }

  .int-status-bar {
    position: fixed;
    inset: 0 0 auto 0;
    height: 40px;
    background: #0F172A;
    z-index: 60;
  }

  .int-header {
    position: sticky;
    top: 40px;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px 0 8px;
    height: 52px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--int-border);
  }

  .int-back {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: var(--int-radius-sm);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--int-text);
  }
  .int-back:hover { background: #F1F5F9; }

  .int-title {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
    text-align: center;
    margin-right: 44px;
  }

  .int-main {
    flex: 1;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: 16px;
  }

  .int-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--int-muted);
    margin: 20px 0 10px;
  }
  .int-section-title:first-child { margin-top: 0; }

  .int-card {
    background: var(--int-card);
    border: 1px solid var(--int-border);
    border-radius: var(--int-radius);
    box-shadow: var(--int-shadow);
    padding: 16px;
    margin-bottom: 12px;
  }

  .int-card-clickable {
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    width: 100%;
    font-family: var(--int-font);
    color: inherit;
  }
  .int-card-clickable:hover {
    border-color: #CBD5E1;
    box-shadow: 0 4px 16px rgba(15,23,42,0.08);
  }

  .int-provider-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
  }
  .int-provider-icon.razorpay { background: #0C2451; color: #fff; }
  .int-provider-icon.shiprocket { background: #6F2DBD; color: #fff; }

  .int-card-body { flex: 1; min-width: 0; }
  .int-card-name { font-size: 15px; font-weight: 600; }
  .int-card-desc { font-size: 12px; color: var(--int-muted); margin-top: 2px; line-height: 1.4; }

  .int-chevron { color: var(--int-faint); flex-shrink: 0; }

  .int-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .int-badge.neutral { background: #F1F5F9; color: #475569; border-color: #E2E8F0; }
  .int-badge.success { background: var(--int-green-bg); color: var(--int-green); border-color: var(--int-green-border); }
  .int-badge.pending { background: var(--int-amber-bg); color: var(--int-amber); border-color: var(--int-amber-border); }
  .int-badge.error { background: var(--int-red-bg); color: var(--int-red); border-color: #F5D5D2; }
  .int-badge.warning { background: var(--int-amber-bg); color: var(--int-amber); border-color: var(--int-amber-border); }

  .int-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: var(--int-radius-sm);
    font-size: 14px;
    font-weight: 600;
    font-family: var(--int-font);
    cursor: pointer;
    border: none;
    transition: opacity 0.15s, background 0.15s;
  }
  .int-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .int-btn-primary { background: var(--int-accent); color: #fff; width: 100%; }
  .int-btn-primary:hover:not(:disabled) { background: #1D4ED8; }
  .int-btn-secondary {
    background: #fff;
    color: var(--int-text);
    border: 1px solid var(--int-border);
  }
  .int-btn-danger { background: #fff; color: var(--int-red); border: 1px solid #F5D5D2; }

  .int-field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--int-muted);
    margin-bottom: 6px;
  }
  .int-field-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--int-border);
    border-radius: var(--int-radius-sm);
    font-size: 14px;
    font-family: var(--int-font);
    background: #fff;
  }
  .int-field-input:focus {
    outline: 2px solid rgba(37, 99, 235, 0.25);
    border-color: var(--int-accent);
  }

  .int-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }

  .int-guide-step {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #F1F5F9;
    font-size: 13px;
    line-height: 1.45;
  }
  .int-guide-step:last-child { border-bottom: none; }
  .int-step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #EFF6FF;
    color: var(--int-accent);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .int-detail-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #F1F5F9;
    font-size: 13px;
  }
  .int-detail-row:last-child { border-bottom: none; }
  .int-detail-label { color: var(--int-muted); flex-shrink: 0; max-width: 46%; }
  .int-detail-value { text-align: right; font-weight: 500; word-break: break-word; max-width: 54%; }
  .int-detail-value.mono { font-family: var(--int-mono); font-size: 12px; }
  .int-detail-section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--int-faint);
    margin-bottom: 4px;
  }

  .int-error-box {
    background: var(--int-red-bg);
    border: 1px solid #F5D5D2;
    border-radius: var(--int-radius-sm);
    padding: 12px;
    font-size: 13px;
    color: var(--int-red);
    margin-bottom: 12px;
  }

  .int-demo-banner {
    margin-bottom: 12px;
    padding: 14px 16px;
    background: var(--int-amber-bg);
    border: 1px solid var(--int-amber-border);
    border-radius: var(--int-radius-sm);
    color: var(--int-amber);
    font-size: 13px;
    line-height: 1.5;
  }
  .int-demo-banner strong { display: block; color: #7A4F12; margin-bottom: 6px; font-size: 14px; }
  .int-demo-banner p { margin: 0 0 8px; }
  .int-demo-banner p:last-child { margin-bottom: 0; }
  .int-demo-banner-sub { font-size: 12px; opacity: 0.92; }

  .int-connected-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--int-green-bg);
    border: 1px solid var(--int-green-border);
    border-radius: var(--int-radius-sm);
    color: var(--int-green);
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .int-loading {
    text-align: center;
    padding: 32px;
    color: var(--int-muted);
    font-size: 14px;
  }

  .int-security-note {
    margin-top: 12px;
    padding: 12px;
    background: #F8FAFC;
    border-radius: var(--int-radius-sm);
    font-size: 12px;
    color: var(--int-muted);
    line-height: 1.5;
  }
  .int-security-note strong { color: var(--int-text); display: block; margin-bottom: 6px; }
  .int-security-note ul { padding-left: 18px; margin: 0; }
`;

export const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);
