import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useState, useMemo } from 'react';
import {
  getSellerStore,
  createStore,
  updateStoreSlug,
  updateStoreCatalogue,
  updateStoreLiveStatus,
  updateStoreWhatsapp,
  normalizeStoreWhatsappInput,
  deleteStore,
  validateStoreSlug,
  type Store,
} from '../services/storeService';
import { getAllCatalogues } from '../config/catalogueConfig';
import { getPublicWebBaseUrl } from '../utils/publicWebBaseUrl';
import MainAppBottomNav from '../components/MainAppBottomNav';

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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
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

/* ─── css — aligned with Orders page (Plus Jakarta Sans, slate palette) ─── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #F8FAFC;
    --card: #FFFFFF;
    --border: #E2E8F0;
    --text-primary: #0F172A;
    --text-secondary: #64748B;
    --text-muted: #94A3B8;
    --accent: #2563EB;
    --accent-soft: #EFF6FF;
    --accent-dark: #1D4ED8;
    --green: #16A34A;
    --green-soft: #F0FDF4;
    --green-border: #BBF7D0;
    --red: #DC2626;
    --red-soft: #FEF2F2;
    --red-border: #FECACA;
    --shadow-sm: 0 1px 3px rgba(15,23,42,0.06);
    --shadow-md: 0 4px 16px rgba(15,23,42,0.08);
    --radius: 16px;
    --radius-sm: 10px;
    --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }

  body { font-family: var(--font); background: var(--bg); }

  .store-root {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--bg);
    font-family: var(--font);
  }

  .status-bar {
    position: fixed;
    inset: 0 0 auto 0;
    height: 40px;
    background: #0F172A;
    z-index: 60;
  }

  .header {
    position: sticky;
    top: 40px;
    z-index: 50;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-height: 52px;
    border-bottom: 1px solid var(--border);
  }
  .header-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.3px;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }
  .header-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font);
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

  .main {
    flex: 1;
    padding: 16px 16px 100px;
    padding-top: 72px;
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
  .toggle-label { font-family: var(--font); font-size: 15px; font-weight: 700; color: var(--text-primary); }
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
  .switch.pending .slider { cursor: wait; opacity: 0.88; }

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
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-family: var(--font);
  }
  .edit-btn {
    display: flex; align-items: center; gap: 4px;
    background: none; border: none;
    font-size: 12px; font-weight: 600; color: var(--accent);
    cursor: pointer; font-family: var(--font);
    padding: 4px 8px; border-radius: 6px;
    transition: background 0.15s;
  }
  .edit-btn:hover { background: var(--accent-soft); }
  .info-value {
    font-family: var(--font);
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
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
    font-family: var(--font);
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .copy-btn:hover { background: var(--accent-dark); }

  /* edit row */
  .edit-row { display: flex; gap: 8px; align-items: flex-start; }
  .edit-row.catalogue-edit-row { align-items: center; flex-wrap: nowrap; }
  .edit-row.catalogue-edit-row .select-wrap {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
  }
  .edit-row.catalogue-edit-row .save-btn,
  .edit-row.catalogue-edit-row .cancel-btn {
    padding-top: 9px;
    padding-bottom: 9px;
    align-self: center;
  }
  .field-input {
    flex: 1;
    padding: 10px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font);
    outline: none;
    background: #fff;
    transition: border-color 0.15s;
    min-width: 0;
  }
  .field-input:focus { border-color: var(--accent); }
  .field-input.error { border-color: var(--red); }
  .save-btn {
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font);
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
    font-family: var(--font);
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
    font-family: var(--font);
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
    font-family: var(--font);
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
  .confirm-title { font-family: var(--font); font-size: 15px; font-weight: 700; color: var(--red); margin-bottom: 6px; }
  .confirm-body { font-size: 13px; color: #991B1B; margin-bottom: 14px; line-height: 1.5; }
  .confirm-row { display: flex; gap: 8px; }
  .confirm-yes {
    flex: 1; padding: 11px;
    border-radius: var(--radius-sm); border: none;
    background: var(--red); color: #fff;
    font-size: 13px; font-weight: 700;
    cursor: pointer; font-family: var(--font);
    transition: opacity 0.15s;
  }
  .confirm-yes:disabled { opacity: 0.6; cursor: not-allowed; }
  .confirm-no {
    flex: 1; padding: 11px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--red-border);
    background: #fff; color: #991B1B;
    font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
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
  .create-title { font-family: var(--font); font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px; }
  .create-sub { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-secondary);
    font-family: var(--font);
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
    font-size: 14px; font-family: var(--font);
    background: transparent;
    min-width: 0;
  }
  .select-wrap {
    position: relative;
    display: block;
    width: 100%;
  }
  .select-wrap svg {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .form-select,
  .field-select {
    width: 100%;
    max-width: 100%;
    min-height: 40px;
    padding: 9px 38px 9px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font);
    line-height: 1.4;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: #fff;
    cursor: pointer;
    outline: none;
    color: var(--text-primary);
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .form-select:focus,
  .field-select:focus { border-color: var(--accent); }
  .form-hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }

  .submit-btn {
    width: 100%; padding: 14px;
    border-radius: var(--radius);
    border: none;
    background: #18160F;
    color: #F4F3EF;
    font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: var(--font);
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
  const [editingField, setEditingField] = useState<'slug' | 'catalogue' | 'whatsapp' | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [liveTogglePending, setLiveTogglePending] = useState(false);

  const [formSlug, setFormSlug] = useState('');
  const [formCatalogue, setFormCatalogue] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formWhatsapp, setFormWhatsapp] = useState('');

  const catalogues = useMemo(() => getAllCatalogues(user?.uid), [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      setLoading(true);
      const result = await getSellerStore(user.uid);
      if (result.success && result.data) {
        setStore(result.data);
        setFormWhatsapp(result.data.storeWhatsapp || '');
        setShowCreateForm(false);
        setIsLive(result.data.isLive);
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
    if (!v.valid) { setSlugError(v.error || 'Check the link name and try again'); return; }
    if (!formCatalogue) { showToast('Please choose which products to show in your store', 'error'); return; }
    setIsSubmitting(true);
    const result = await createStore(user.uid, formSlug, formCatalogue);
    if (result.success && result.data) {
      setStore(result.data);
      setIsLive(result.data.isLive);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setShowCreateForm(false);
      setFormSlug(''); setFormCatalogue('');
      showToast('Store created!', 'success');
    } else {
      if (result.suggestedSlugs?.length) { setSlugError(result.error || 'That name is already taken'); setSlugSuggestions(result.suggestedSlugs); }
      else setSlugError(result.error || 'Failed to create store');
      showToast(result.error || 'Failed to create store', 'error');
    }
    setIsSubmitting(false);
  };

  const handleUpdateSlug = async (newSlug: string) => {
    if (!user?.uid) return;
    const v = validateStoreSlug(newSlug);
    if (!v.valid) { showToast(v.error || 'Check the link name and try again', 'error'); return; }
    setIsSubmitting(true);
    const result = await updateStoreSlug(user.uid, newSlug);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setEditingField(null);
      showToast('Store link updated', 'success');
    } else {
      showToast(result.suggestedSlugs ? `${result.error} Try: ${result.suggestedSlugs.join(', ')}` : (result.error || 'Failed'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleUpdateCatalogue = async (catId: string) => {
    if (!user?.uid) return;
    setIsSubmitting(true);
    const result = await updateStoreCatalogue(user.uid, catId);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setEditingField(null);
      showToast('Products list updated', 'success');
    }
    else showToast(result.error || 'Failed', 'error');
    setIsSubmitting(false);
  };

  const handleSaveWhatsapp = async () => {
    if (!user?.uid) return;
    const n = normalizeStoreWhatsappInput(formWhatsapp);
    if (n.ok === false) {
      showToast(n.error, 'error');
      return;
    }
    setIsSubmitting(true);
    const result = await updateStoreWhatsapp(user.uid, n.value);
    if (result.success && result.data) {
      setStore(result.data);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      setEditingField(null);
      showToast(n.value ? 'WhatsApp updated for your store' : 'WhatsApp removed from your store', 'success');
    } else showToast(result.error || 'Failed to save', 'error');
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

  const handleLiveToggle = async () => {
    if (!user?.uid || liveTogglePending) return;
    const prev = isLive;
    const next = !prev;
    setIsLive(next);
    setLiveTogglePending(true);
    const result = await updateStoreLiveStatus(user.uid, next);
    setLiveTogglePending(false);
    if (result.success && result.data) {
      setStore(result.data);
      setIsLive(result.data.isLive);
      setFormWhatsapp(result.data.storeWhatsapp || '');
      showToast(
        next ? 'Store is now live' : 'Store is offline — visitors see a paused message',
        next ? 'success' : 'info'
      );
    } else {
      setIsLive(prev);
      showToast(result.error || 'Could not update store status', 'error');
    }
  };

  const publicWebBase = getPublicWebBaseUrl();
  const storeUrlHostPrefix = publicWebBase
    ? (() => {
        try {
          return new URL(publicWebBase).host;
        } catch {
          return publicWebBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
      })()
    : typeof window !== 'undefined'
      ? window.location.host
      : 'yourapp.com';

  const getStoreUrl = () => (store ? `${publicWebBase}/store/${store.storeSlug}` : '');
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
                <p className="create-sub">Open a simple online shop with your own link that you can share anywhere.</p>
              </div>

              <form onSubmit={handleCreateStore}>
                <div className="form-group">
                  <label className="form-label">Choose your store link name <span>*</span></label>
                  <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                    This is the ending of your address after <strong>/store/</strong>. Use small letters, numbers, and hyphens only—no spaces.
                  </p>
                  <div className={`slug-prefix${slugError ? ' error' : ''}`}>
                    <span className="slug-pre">{storeUrlHostPrefix}/store/</span>
                    <input
                      type="text"
                      className="slug-field"
                      value={formSlug}
                      onChange={e => validateAndSetSlug(e.target.value)}
                      placeholder="e.g. my-bakery"
                    />
                  </div>
                  {slugError && <div className="error-text">{slugError}</div>}
                  {slugSuggestions.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 4 }}>Try one of these names:</div>
                      <div className="suggestions">
                        {slugSuggestions.map(s => (
                          <button key={s} type="button" className="sug-chip" onClick={() => validateAndSetSlug(s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Which products to show <span>*</span></label>
                  <div className="select-wrap">
                    <select className="form-select" value={formCatalogue} onChange={e => setFormCatalogue(e.target.value)}>
                      <option value="">— Pick a product list —</option>
                      {catalogues.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <IconChevron />
                  </div>
                  <p className="form-hint">Only products from this list appear in your shop. You can change it later.</p>
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
                <label className={`switch${liveTogglePending ? ' pending' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isLive}
                    disabled={liveTogglePending}
                    onChange={() => void handleLiveToggle()}
                  />
                  <span className="slider" />
                </label>
              </div>

              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label"><IconLink /> &nbsp;Your store link</div>
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

              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label">Link name</div>
                  {editingField !== 'slug' && (
                    <button className="edit-btn" onClick={() => { setEditingField('slug'); setFormSlug(store.storeSlug); setSlugError(''); }}>
                      <IconEdit /> Edit
                    </button>
                  )}
                </div>

                {editingField === 'slug' ? (
                  <>
                    <p className="form-hint" style={{ marginBottom: 10 }}>Small letters, numbers, and hyphens only. Changing this changes your full store address.</p>
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
                  <>
                    <div className="info-value mono">{store.storeSlug}</div>
                    <p className="form-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                      The text at the end of your store address (after <strong>/store/</strong>).
                    </p>
                  </>
                )}
              </div>

              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label">Products shown</div>
                  {editingField !== 'catalogue' && (
                    <button className="edit-btn" onClick={() => { setEditingField('catalogue'); setFormCatalogue(store.catalogueId); }}>
                      <IconEdit /> Change
                    </button>
                  )}
                </div>

                {editingField === 'catalogue' ? (
                  <div className="edit-row catalogue-edit-row">
                    <div className="select-wrap">
                      <select className="field-select" value={formCatalogue} onChange={e => setFormCatalogue(e.target.value)} aria-label="Choose product list">
                        {catalogues.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <IconChevron />
                    </div>
                    <button type="button" className="save-btn" disabled={isSubmitting} onClick={() => handleUpdateCatalogue(formCatalogue)}>Save</button>
                    <button type="button" className="cancel-btn" onClick={() => { setEditingField(null); setFormCatalogue(''); }}>Cancel</button>
                  </div>
                ) : (
                  <div className="info-value">{getCatalogueName(store.catalogueId)}</div>
                )}
              </div>

              <div className="info-card section-gap">
                <div className="info-card-row">
                  <div className="info-card-label">WhatsApp for customers</div>
                  {editingField !== 'whatsapp' && (
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => {
                        setEditingField('whatsapp');
                        setFormWhatsapp(store.storeWhatsapp || '');
                      }}
                    >
                      <IconEdit /> {store.storeWhatsapp ? 'Change' : 'Add'}
                    </button>
                  )}
                </div>
                <p className="form-hint" style={{ marginTop: 0, marginBottom: editingField === 'whatsapp' ? 10 : 8 }}>
                  Customers will see a WhatsApp button. Format: +91 98xxxxxxxx
                </p>
                {editingField === 'whatsapp' ? (
                  <div className="edit-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="field-input"
                      style={{ flex: '1 1 200px' }}
                      placeholder="+91 98xxxxxxxx"
                      value={formWhatsapp}
                      onChange={(e) => setFormWhatsapp(e.target.value)}
                      aria-label="WhatsApp number"
                    />
                    <button type="button" className="save-btn" disabled={isSubmitting} onClick={() => void handleSaveWhatsapp()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => {
                        setEditingField(null);
                        setFormWhatsapp(store.storeWhatsapp || '');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="info-value" style={{ fontWeight: store.storeWhatsapp ? 600 : 400, color: store.storeWhatsapp ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {store.storeWhatsapp || 'Not set'}
                  </div>
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
                  <p className="confirm-body">This can't be undone. Your store link will stop working for customers right away.</p>
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
        <MainAppBottomNav active="store" />
      </div>
    </>
  );
}
