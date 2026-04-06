import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useState, useMemo } from 'react';
import {
  getSellerStore,
  createStore,
  updateStoreSlug,
  updateStoreCatalogue,
  deleteStore,
  validateStoreSlug,
  type Store,
} from '../services/storeService';
import { getAllCatalogues } from '../config/catalogueConfig';

/* ─── tiny icons ─────────────────────────────────────────────── */
const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const IconChevron = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const IconStore = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 9l1-5h16l1 5" />
    <path d="M3 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0" />
    <path d="M5 9v11h14V9" />
    <path d="M10 14h4v6H10z" />
  </svg>
);
const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
  </svg>
);

/* ─── css injected once ────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #F4F3EF;
    --card: #FFFFFF;
    --border: #E2DDD5;
    --text-primary: #18160F;
    --text-secondary: #7A7469;
    --text-muted: #B0AAA0;
    --accent: #E85D00;
    --accent-soft: #FFF0E8;
    --accent-dark: #C24B00;
    --green: #15803D;
    --green-soft: #F0FDF4;
    --green-border: #BBF7D0;
    --red: #DC2626;
    --red-soft: #FEF2F2;
    --red-border: #FECACA;
    --blue: #2563EB;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
    --radius: 14px;
    --radius-sm: 8px;
    --font-head: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }

  body { font-family: var(--font-body); background: var(--bg); }

  .store-root {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--bg);
    font-family: var(--font-body);
  }

  /* status bar */
  .status-bar {
    position: fixed;
    inset: 0 0 auto 0;
    height: 44px;
    background: #18160F;
    z-index: 60;
  }

  /* header */
  .header {
    position: sticky;
    top: 44px;
    z-index: 50;
    background: #fff;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: 52px;
    border-bottom: 1px solid #E2E8F0;
    box-shadow: 0 1px 8px rgba(0,0,0,0.05);
  }
  .header-title {
    font-size: 20px;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.4px;
    line-height: 1;
    display: flex;
    align-items: center;
    height: 100%;
  }
  .header-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-body);
    letter-spacing: 0.2px;
    transition: all 0.2s;
    margin-left: auto;
  }
  .header-badge.live {
    background: rgba(21,128,61,0.15);
    color: #15803D;
    border: 1px solid rgba(21,128,61,0.3);
  }
  .header-badge.offline {
    background: #F1F5F9;
    color: #64748B;
    border: 1px solid #E2E8F0;
  }
  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .badge-dot.live { background: #4ADE80; box-shadow: 0 0 0 3px rgba(74,222,128,0.3); animation: pulse-dot 2s infinite; }
  .badge-dot.offline { background: rgba(255,255,255,0.3); }
  @keyframes pulse-dot {
    0%, 100% { box-shadow: 0 0 0 3px rgba(74,222,128,0.3); }
    50% { box-shadow: 0 0 0 5px rgba(74,222,128,0.1); }
  }

  /* main */
  .main {
    flex: 1;
    padding: 20px 16px 100px;
    padding-top: 80px;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
  }

  /* live toggle card */
  .toggle-card {
    background: var(--card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    padding: 18px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.2s;
  }
  .toggle-card.live-on { border-color: var(--green-border); background: var(--green-soft); }
  .toggle-info { display: flex; flex-direction: column; gap: 2px; }
  .toggle-label { font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--text-primary); }
  .toggle-sub { font-size: 12px; color: var(--text-secondary); }
  .toggle-sub.live { color: var(--green); }

  /* toggle switch */
  .switch { position: relative; width: 52px; height: 28px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute; inset: 0;
    background: #D1CBC3;
    border-radius: 28px;
    cursor: pointer;
    transition: background 0.25s;
  }
  .slider::before {
    content: '';
    position: absolute;
    width: 22px; height: 22px;
    left: 3px; top: 3px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);
  }
  input:checked + .slider { background: var(--green); }
  input:checked + .slider::before { transform: translateX(24px); }

  /* info card */
  .info-card {
    background: var(--card);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    padding: 18px 20px;
    margin-bottom: 12px;
    box-shadow: var(--shadow-sm);
  }
  .info-card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .info-card-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-family: var(--font-head);
  }
  .edit-btn {
    display: flex; align-items: center; gap: 4px;
    background: none; border: none;
    font-size: 12px; font-weight: 600; color: var(--accent);
    cursor: pointer; font-family: var(--font-body);
    padding: 4px 8px; border-radius: 6px;
    transition: background 0.15s;
  }
  .edit-btn:hover { background: var(--accent-soft); }
  .info-value {
    font-family: var(--font-head);
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }
  .mono { font-family: 'SFMono-Regular', 'Menlo', monospace; font-size: 15px; }

  /* url row */
  .url-row { display: flex; gap: 8px; align-items: center; }
  .url-input {
    flex: 1;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-family: monospace;
    color: var(--text-primary);
    outline: none;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .copy-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 14px;
    background: var(--accent);
    color: white;
    border: none; border-radius: var(--radius-sm);
    font-size: 12px; font-weight: 700; cursor: pointer;
    font-family: var(--font-body);
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .copy-btn:hover { background: var(--accent-dark); }

  /* edit row */
  .edit-row { display: flex; gap: 8px; align-items: flex-start; }
  .field-input {
    flex: 1;
    padding: 10px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font-body);
    outline: none;
    background: #fff;
    transition: border-color 0.15s;
    min-width: 0;
  }
  .field-input:focus { border-color: var(--accent); }
  .field-input.error { border-color: var(--red); }
  .field-select {
    flex: 1;
    padding: 10px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font-body);
    outline: none;
    background: #fff;
    appearance: none;
    cursor: pointer;
    min-width: 0;
    transition: border-color 0.15s;
  }
  .field-select:focus { border-color: var(--accent); }
  .save-btn {
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-body);
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .save-btn:hover { background: var(--accent-dark); }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cancel-btn {
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    font-family: var(--font-body);
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .cancel-btn:hover { background: var(--bg); }
  .error-text { font-size: 12px; color: var(--red); margin-top: 6px; }

  /* slug suggestions */
  .suggestions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .sug-chip {
    padding: 4px 10px;
    border-radius: 20px;
    border: 1.5px solid var(--border);
    background: var(--bg);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    font-family: var(--font-body);
    transition: all 0.15s;
  }
  .sug-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }

  /* delete section */
  .delete-btn {
    width: 100%;
    padding: 14px;
    border-radius: var(--radius);
    border: 1.5px solid var(--red-border);
    background: var(--red-soft);
    color: var(--red);
    font-size: 14px; font-weight: 600;
    cursor: pointer;
    font-family: var(--font-body);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .delete-btn:hover { background: #fee2e2; }
  .confirm-card {
    background: var(--red-soft);
    border-radius: var(--radius);
    border: 1.5px solid var(--red-border);
    padding: 18px 20px;
    margin-top: 4px;
  }
  .confirm-title { font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--red); margin-bottom: 6px; }
  .confirm-body { font-size: 13px; color: #991B1B; margin-bottom: 14px; line-height: 1.5; }
  .confirm-row { display: flex; gap: 8px; }
  .confirm-yes {
    flex: 1; padding: 11px;
    border-radius: var(--radius-sm); border: none;
    background: var(--red); color: #fff;
    font-size: 13px; font-weight: 700;
    cursor: pointer; font-family: var(--font-body);
    transition: opacity 0.15s;
  }
  .confirm-yes:disabled { opacity: 0.6; cursor: not-allowed; }
  .confirm-no {
    flex: 1; padding: 11px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--red-border);
    background: #fff; color: #991B1B;
    font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: var(--font-body);
  }

  /* create form */
  .create-hero { text-align: center; padding: 24px 0 20px; }
  .create-icon {
    width: 72px; height: 72px;
    background: #18160F;
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
    color: #F4F3EF;
  }
  .create-title { font-family: var(--font-head); font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px; }
  .create-sub { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-secondary);
    font-family: var(--font-head);
    margin-bottom: 8px;
  }
  .form-label span { color: var(--red); }
  .slug-prefix {
    display: flex; align-items: center; gap: 0;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: #fff;
    transition: border-color 0.15s;
  }
  .slug-prefix:focus-within { border-color: var(--accent); }
  .slug-prefix.error { border-color: var(--red); }
  .slug-pre {
    padding: 11px 10px 11px 14px;
    font-size: 13px;
    color: var(--text-muted);
    background: var(--bg);
    border-right: 1.5px solid var(--border);
    white-space: nowrap;
    font-family: monospace;
  }
  .slug-field {
    flex: 1; padding: 11px 14px;
    border: none; outline: none;
    font-size: 14px; font-family: var(--font-body);
    background: transparent;
    min-width: 0;
  }
  .select-wrap { position: relative; }
  .select-wrap svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); }
  .form-select {
    width: 100%;
    padding: 11px 38px 11px 14px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font-body);
    appearance: none;
    background: #fff;
    cursor: pointer;
    outline: none;
    color: var(--text-primary);
    transition: border-color 0.15s;
  }
  .form-select:focus { border-color: var(--accent); }
  .form-hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }

  .submit-btn {
    width: 100%; padding: 14px;
    border-radius: var(--radius);
    border: none;
    background: #18160F;
    color: #F4F3EF;
    font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: var(--font-head);
    letter-spacing: 0.2px;
    transition: opacity 0.15s, background 0.15s;
  }
  .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .submit-btn:not(:disabled):hover { background: #2c2a21; }

  /* spinner */
  .spinner {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loader { display: flex; justify-content: center; align-items: center; height: 200px; }

  /* bottom nav */
  .bottom-nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 30;
    background: #fff;
    display: flex;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid #E2E8F0;
  }
  .nav-btn {
    flex: 1; padding: 14px 16px;
    background: #fff; border: none;
    font-family: inherit;
    font-size: 14px; font-weight: 500;
    cursor: pointer;
    color: #4B5563;
    transition: all 0.15s;
    text-align: center;
  }
  .nav-btn.active {
    background: #2563EB;
    color: #fff;
  }
  .nav-btn:not(.active):hover { background: #F8FAFC; }

  /* section divider */
  .section-gap { margin-bottom: 12px; }
`;

export default function StorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingField, setEditingField] = useState<'slug' | 'catalogue' | null>(null);
  const [isLive, setIsLive] = useState(true);

  const [formSlug, setFormSlug] = useState('');
  const [formCatalogue, setFormCatalogue] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const catalogues = useMemo(() => getAllCatalogues(user?.uid), [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      setLoading(true);
      const result = await getSellerStore(user.uid);
      if (result.success && result.data) {
        setStore(result.data);
        setShowCreateForm(false);
        // persist live state from store data if available
        if (typeof (result.data as any).isLive === 'boolean') {
          setIsLive((result.data as any).isLive);
        }
      } else {
        setStore(null);
        setShowCreateForm(true);
      }
      setLoading(false);
    };
    load();
  }, [user?.uid]);

  const validateAndSetSlug = (slug: string) => {
    setFormSlug(slug);
    const v = validateStoreSlug(slug);
    if (!v.valid) { setSlugError(v.error || ''); setSlugSuggestions([]); }
    else { setSlugError(''); setSlugSuggestions([]); }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    const v = validateStoreSlug(formSlug);
    if (!v.valid) { setSlugError(v.error || 'Invalid slug'); return; }
    if (!formCatalogue) { showToast('Please select a catalogue', 'error'); return; }
    setIsSubmitting(true);
    const result = await createStore(user.uid, formSlug, formCatalogue);
    if (result.success && result.data) {
      setStore(result.data); setShowCreateForm(false);
      setFormSlug(''); setFormCatalogue('');
      showToast('Store created!', 'success');
    } else {
      if (result.suggestedSlugs?.length) { setSlugError(result.error || 'Slug not available'); setSlugSuggestions(result.suggestedSlugs); }
      else setSlugError(result.error || 'Failed to create store');
      showToast(result.error || 'Failed to create store', 'error');
    }
    setIsSubmitting(false);
  };

  const handleUpdateSlug = async (newSlug: string) => {
    if (!user?.uid) return;
    const v = validateStoreSlug(newSlug);
    if (!v.valid) { showToast(v.error || 'Invalid slug', 'error'); return; }
    setIsSubmitting(true);
    const result = await updateStoreSlug(user.uid, newSlug);
    if (result.success && result.data) {
      setStore(result.data); setEditingField(null);
      showToast('Slug updated!', 'success');
    } else {
      showToast(result.suggestedSlugs ? `${result.error} Try: ${result.suggestedSlugs.join(', ')}` : (result.error || 'Failed'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleUpdateCatalogue = async (catId: string) => {
    if (!user?.uid) return;
    setIsSubmitting(true);
    const result = await updateStoreCatalogue(user.uid, catId);
    if (result.success && result.data) { setStore(result.data); setEditingField(null); showToast('Catalogue updated!', 'success'); }
    else showToast(result.error || 'Failed', 'error');
    setIsSubmitting(false);
  };

  const handleDeleteStore = async () => {
    if (!user?.uid) return;
    setIsSubmitting(true);
    const result = await deleteStore(user.uid);
    if (result.success) {
      setStore(null); setShowCreateForm(true); setConfirmDelete(false);
      showToast('Store deleted', 'success');
    } else showToast(result.error || 'Failed', 'error');
    setIsSubmitting(false);
  };

  const handleLiveToggle = () => {
    const next = !isLive;
    setIsLive(next);
    showToast(next ? 'Store is now live 🟢' : 'Store paused — visitors will see offline page', next ? 'success' : 'error');
    // TODO: persist to backend — e.g. updateStoreLiveStatus(user.uid, next)
  };

  const getStoreUrl = () => store ? `${window.location.origin}/store/${store.storeSlug}` : '';
  const getCatalogueName = (id: string) => catalogues.find(c => c.id === id)?.label || id;

  return (
    <>
      <style>{CSS}</style>
      <div className="store-root">
        <div className="status-bar" />

        {/* Header */}
        <div className="header">
          <span className="header-title">My Store</span>
          {store && (
            <span className={`header-badge ${isLive ? 'live' : 'offline'}`}>
              <span className={`badge-dot ${isLive ? 'live' : 'offline'}`} />
              {isLive ? 'Live' : 'Offline'}
            </span>
          )}
        </div>

        <main className="main">
          {loading ? (
            <div className="loader"><div className="spinner" /></div>
          ) : !store ? (
            /* ── CREATE FORM ── */
            <div>
              <div className="create-hero">
                <div className="create-icon"><IconStore /></div>
                <h2 className="create-title">Set Up Your Store</h2>
                <p className="create-sub">Create a permanent storefront with a custom URL to start selling.</p>
              </div>

              <form onSubmit={handleCreateStore}>
                {/* Slug */}
                <div className="form-group">
                  <label className="form-label">Store URL <span>*</span></label>
                  <div className={`slug-prefix${slugError ? ' error' : ''}`}>
                    <span className="slug-pre">yourapp.com/store/</span>
                    <input
                      type="text"
                      className="slug-field"
                      value={formSlug}
                      onChange={e => validateAndSetSlug(e.target.value)}
                      placeholder="my-shop"
                    />
                  </div>
                  {slugError && <div className="error-text">{slugError}</div>}
                  {slugSuggestions.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 4 }}>Try these:</div>
                      <div className="suggestions">
                        {slugSuggestions.map(s => (
                          <button key={s} type="button" className="sug-chip" onClick={() => validateAndSetSlug(s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Catalogue */}
                <div className="form-group">
                  <label className="form-label">Catalogue <span>*</span></label>
                  <div className="select-wrap">
                    <select className="form-select" value={formCatalogue} onChange={e => setFormCatalogue(e.target.value)}>
                      <option value="">— Choose a catalogue —</option>
                      {catalogues.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <IconChevron />
                  </div>
                  <p className="form-hint">All products from this catalogue will appear in your store.</p>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSubmitting || !formSlug || !formCatalogue || !!slugError}
                >
                  {isSubmitting ? 'Creating…' : 'Create Store →'}
                </button>
              </form>
            </div>
          ) : (
            /* ── STORE DETAILS ── */
            <div>
              {/* Live / Offline toggle */}
              <div className={`toggle-card${isLive ? ' live-on' : ''}`}>
                <div className="toggle-info">
                  <div className="toggle-label">{isLive ? 'Store is Live' : 'Store is Offline'}</div>
                  <div className={`toggle-sub${isLive ? ' live' : ''}`}>
                    {isLive ? 'Customers can browse and order' : 'Hidden from customers'}
                  </div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={isLive} onChange={handleLiveToggle} />
                  <span className="slider" />
                </label>
              </div>

              {/* Store URL */}
              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label"><IconLink /> &nbsp;Store URL</div>
                </div>
                <div className="url-row">
                  <input type="text" className="url-input" value={getStoreUrl()} readOnly />
                  <button
                    className="copy-btn"
                    onClick={() => { navigator.clipboard.writeText(getStoreUrl()); showToast('Copied!', 'success'); }}
                  >
                    <IconCopy /> Copy
                  </button>
                </div>
              </div>

              {/* Slug */}
              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label">URL Slug</div>
                  {editingField !== 'slug' && (
                    <button className="edit-btn" onClick={() => { setEditingField('slug'); setFormSlug(store.storeSlug); setSlugError(''); }}>
                      <IconEdit /> Edit
                    </button>
                  )}
                </div>

                {editingField === 'slug' ? (
                  <>
                    <div className="edit-row">
                      <input
                        type="text"
                        className={`field-input${slugError ? ' error' : ''}`}
                        value={formSlug}
                        onChange={e => validateAndSetSlug(e.target.value)}
                        autoFocus
                      />
                      <button className="save-btn" disabled={isSubmitting || !formSlug || !!slugError} onClick={() => handleUpdateSlug(formSlug)}>Save</button>
                      <button className="cancel-btn" onClick={() => { setEditingField(null); setFormSlug(''); setSlugError(''); }}>✕</button>
                    </div>
                    {slugError && <div className="error-text">{slugError}</div>}
                  </>
                ) : (
                  <div className="info-value mono">{store.storeSlug}</div>
                )}
              </div>

              {/* Catalogue */}
              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label">Catalogue</div>
                  {editingField !== 'catalogue' && (
                    <button className="edit-btn" onClick={() => { setEditingField('catalogue'); setFormCatalogue(store.catalogueId); }}>
                      <IconEdit /> Change
                    </button>
                  )}
                </div>

                {editingField === 'catalogue' ? (
                  <div className="edit-row">
                    <div className="select-wrap" style={{ flex: 1, minWidth: 0 }}>
                      <select className="field-select" value={formCatalogue} onChange={e => setFormCatalogue(e.target.value)}>
                        {catalogues.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <IconChevron />
                    </div>
                    <button className="save-btn" disabled={isSubmitting} onClick={() => handleUpdateCatalogue(formCatalogue)}>Save</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setFormCatalogue(''); }}>✕</button>
                  </div>
                ) : (
                  <div className="info-value">{getCatalogueName(store.catalogueId)}</div>
                )}
              </div>

              {/* Delete */}
              {!confirmDelete ? (
                <button className="delete-btn" onClick={() => setConfirmDelete(true)}>
                  <IconTrash /> Delete Store
                </button>
              ) : (
                <div className="confirm-card">
                  <div className="confirm-title">Delete this store?</div>
                  <p className="confirm-body">This can't be undone. Your store URL will stop working immediately.</p>
                  <div className="confirm-row">
                    <button className="confirm-yes" disabled={isSubmitting} onClick={handleDeleteStore}>
                      {isSubmitting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                    <button className="confirm-no" onClick={() => setConfirmDelete(false)}>Keep It</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="bottom-nav">
          <button className="nav-btn" onClick={() => navigate('/orders')}>Orders</button>
          <button className="nav-btn active">Store</button>
        </nav>
      </div>
    </>
  );
}
