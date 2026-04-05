import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useEffect, useState, useMemo } from 'react';
import { getSellerStore, createStore, updateStoreSlug, updateStoreCatalogue, deleteStore, validateStoreSlug, generateSlugAlternatives, type Store } from '../services/storeService';
import { getAllCatalogues } from '../config/catalogueConfig';

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function Store() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingField, setEditingField] = useState<'slug' | 'catalogue' | null>(null);
  
  // Form state
  const [formSlug, setFormSlug] = useState('');
  const [formCatalogue, setFormCatalogue] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  const catalogues = useMemo(() => getAllCatalogues(user?.uid), [user?.uid]);
  
  // Fetch existing store on mount
  useEffect(() => {
    if (!user?.uid) return;
    
    const loadStore = async () => {
      setLoading(true);
      const result = await getSellerStore(user.uid);
      if (result.success && result.data) {
        setStore(result.data);
        setShowCreateForm(false);
      } else {
        setStore(null);
        setShowCreateForm(true);
      }
      setLoading(false);
    };
    
    loadStore();
  }, [user?.uid]);
  
  const handleNavigate = (path: string) => {
    navigate(path);
  };
  
  const validateAndSetSlug = (slug: string) => {
    setFormSlug(slug);
    const validation = validateStoreSlug(slug);
    if (!validation.valid) {
      setSlugError(validation.error || '');
      setSlugSuggestions([]);
    } else {
      setSlugError('');
      setSlugSuggestions([]);
    }
  };
  
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.uid) return;
    
    const validation = validateStoreSlug(formSlug);
    if (!validation.valid) {
      setSlugError(validation.error || 'Invalid slug');
      return;
    }
    
    if (!formCatalogue) {
      showToast('Please select a catalogue', 'error');
      return;
    }
    
    setIsSubmitting(true);
    const result = await createStore(user.uid, formSlug, formCatalogue);
    
    if (result.success && result.data) {
      setStore(result.data);
      setShowCreateForm(false);
      setFormSlug('');
      setFormCatalogue('');
      showToast('Store created successfully!', 'success');
    } else {
      if (result.suggestedSlugs && result.suggestedSlugs.length > 0) {
        setSlugError(result.error || 'Slug not available');
        setSlugSuggestions(result.suggestedSlugs);
      } else {
        setSlugError(result.error || 'Failed to create store');
      }
      showToast(result.error || 'Failed to create store', 'error');
    }
    
    setIsSubmitting(false);
  };
  
  const handleUpdateSlug = async (newSlug: string) => {
    if (!user?.uid) return;
    
    const validation = validateStoreSlug(newSlug);
    if (!validation.valid) {
      showToast(validation.error || 'Invalid slug', 'error');
      return;
    }
    
    setIsSubmitting(true);
    const result = await updateStoreSlug(user.uid, newSlug);
    
    if (result.success && result.data) {
      setStore(result.data);
      setEditingField(null);
      showToast('Store slug updated!', 'success');
    } else {
      if (result.suggestedSlugs) {
        showToast(`${result.error} Try: ${result.suggestedSlugs.join(', ')}`, 'error');
      } else {
        showToast(result.error || 'Failed to update slug', 'error');
      }
    }
    
    setIsSubmitting(false);
  };
  
  const handleUpdateCatalogue = async (newCatalogueId: string) => {
    if (!user?.uid) return;
    
    setIsSubmitting(true);
    const result = await updateStoreCatalogue(user.uid, newCatalogueId);
    
    if (result.success && result.data) {
      setStore(result.data);
      setEditingField(null);
      showToast('Catalogue updated!', 'success');
    } else {
      showToast(result.error || 'Failed to update catalogue', 'error');
    }
    
    setIsSubmitting(false);
  };
  
  const handleDeleteStore = async () => {
    if (!user?.uid) return;
    
    setIsSubmitting(true);
    const result = await deleteStore(user.uid);
    
    if (result.success) {
      setStore(null);
      setShowCreateForm(true);
      setConfirmDelete(false);
      showToast('Store deleted', 'success');
    } else {
      showToast(result.error || 'Failed to delete store', 'error');
    }
    
    setIsSubmitting(false);
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };
  
  const getStoreUrl = () => {
    if (!store) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/store/${store.storeSlug}`;
  };
  
  const getCatalogueName = (catId: string) => {
    const cat = catalogues.find(c => c.id === catId);
    return cat?.label || catId;
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
        paddingTop: 16,
        padding: 16,
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : !store ? (
          // Create Store Form
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏪</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                Create Your Store
              </h2>
              <p style={{ fontSize: 14, color: '#64748B' }}>
                Set up a permanent store to showcase your products with a custom URL
              </p>
            </div>
            
            <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Slug Input */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
                  Store URL Slug <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, color: '#64748B' }}>yourapp.com/store/</div>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => validateAndSetSlug(e.target.value)}
                    placeholder="e.g., refresh, myshop"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: slugError ? '1.5px solid #DC2626' : '1px solid #D1D5DB',
                      borderRadius: 8,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {slugError && (
                  <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>
                    {slugError}
                  </div>
                )}
                {slugSuggestions.length > 0 && (
                  <div style={{ fontSize: 12, color: '#0F172A', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Try these instead:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {slugSuggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => validateAndSetSlug(s)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #D1D5DB',
                            background: '#F8FAFC',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Catalogue Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
                  Select Catalogue <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={formCatalogue}
                    onChange={(e) => setFormCatalogue(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 12px',
                      border: '1px solid #D1D5DB',
                      borderRadius: 8,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      appearance: 'none',
                      background: '#fff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Choose a catalogue --</option>
                    {catalogues.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <div style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#94A3B8',
                  }}>
                    <IconChevronDown />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
                  All products from this catalogue will be visible in your store
                </p>
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !formSlug || !formCatalogue || !!slugError}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: formSlug && formCatalogue && !slugError ? '#2563EB' : '#D1D5DB',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: (formSlug && formCatalogue && !slugError && !isSubmitting) ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Creating Store…' : 'Create Store'}
              </button>
            </form>
          </div>
        ) : (
          // Store Details
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 24 }}>✅</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#166534' }}>Store Active</h2>
              </div>
              <p style={{ fontSize: 14, color: '#64748B' }}>Your store is live and ready to accept orders</p>
            </div>
            
            {/* Store URL */}
            <div style={{
              padding: 16,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8, textTransform: 'uppercase' }}>
                Store URL
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  value={getStoreUrl()}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #E2E8F0',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    background: '#F8FAFC',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => copyToClipboard(getStoreUrl())}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#2563EB',
                    fontFamily: 'inherit',
                  }}
                >
                  <IconCopy /> Copy
                </button>
              </div>
            </div>
            
            {/* Store Slug */}
            <div style={{
              padding: 16,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Store Slug
                </div>
                {editingField !== 'slug' && (
                  <button
                    onClick={() => {
                      setEditingField('slug');
                      setFormSlug(store.storeSlug);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      padding: 0,
                    }}
                  >
                    <IconEdit /> Edit
                  </button>
                )}
              </div>
              
              {editingField === 'slug' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => validateAndSetSlug(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: slugError ? '1.5px solid #DC2626' : '1px solid #E2E8F0',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => handleUpdateSlug(formSlug)}
                    disabled={isSubmitting || !formSlug || !!slugError}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563EB',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setFormSlug('');
                      setSlugError('');
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#64748B',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                  {store.storeSlug}
                </div>
              )}
              
              {slugError && editingField === 'slug' && (
                <div style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{slugError}</div>
              )}
            </div>
            
            {/* Linked Catalogue */}
            <div style={{
              padding: 16,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Linked Catalogue
                </div>
                {editingField !== 'catalogue' && (
                  <button
                    onClick={() => {
                      setEditingField('catalogue');
                      setFormCatalogue(store.catalogueId);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      padding: 0,
                    }}
                  >
                    <IconEdit /> Change
                  </button>
                )}
              </div>
              
              {editingField === 'catalogue' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={formCatalogue}
                    onChange={(e) => setFormCatalogue(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                      background: '#fff',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {catalogues.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdateCatalogue(formCatalogue)}
                    disabled={isSubmitting}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563EB',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setFormCatalogue('');
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#64748B',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                  {getCatalogueName(store.catalogueId)}
                </div>
              )}
            </div>
            
            {/* Delete Store */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1.5px solid #FEE2E2',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <IconTrash /> Delete Store
              </button>
            ) : (
              <div style={{
                padding: 16,
                background: '#FEF2F2',
                borderRadius: 12,
                border: '1.5px solid #FEE2E2',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', marginBottom: 12 }}>
                  Delete your store?
                </div>
                <p style={{ fontSize: 13, color: '#991B1B', marginBottom: 12 }}>
                  This cannot be undone. Your store URL will become unavailable.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleDeleteStore()}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#DC2626',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  >
                    {isSubmitting ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid #FEE2E2',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#991B1B',
                      fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
