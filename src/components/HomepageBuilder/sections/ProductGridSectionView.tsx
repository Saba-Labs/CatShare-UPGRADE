import React from 'react';
import { Link } from 'react-router-dom';
import { ProductGridSection } from '../../../types/homepage';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import WebsiteProductCard from '../../WebsiteBuilder/WebsiteProductCard';
import { IconImage } from '../../Storefront/StorefrontIcons';

interface ProductGridSectionViewProps {
  section: ProductGridSection & { id: string };
  editMode?: boolean;
}

export default function ProductGridSectionView({ section, editMode }: ProductGridSectionViewProps) {
  const { settings, content } = section;
  const storeCtx = useWebsiteStoreOptional();

  let displayProducts = storeCtx?.products || [];
  if (storeCtx && content.categoryId) {
    const catId = String(content.categoryId).toLowerCase();
    displayProducts = displayProducts.filter((p) => {
      const cats = Array.isArray(p.category) ? p.category : p.category ? [String(p.category)] : [];
      return cats.some((c) => String(c).toLowerCase() === catId);
    });
  }
  if (storeCtx && content.productIds?.length) {
    displayProducts = content.productIds
      .map((id) => storeCtx.products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }
  const limited = displayProducts.slice(0, settings.itemsToShow);

  return (
    <div className="website-section-products" style={{ background: settings.backgroundColor || 'transparent' }}>
      {settings.showSearch && editMode && (
        <input
          type="text"
          placeholder="Search (preview only in live store)"
          className="panel-input"
          style={{ marginBottom: 16 }}
          disabled
        />
      )}

      <h2>{settings.title}</h2>

      {storeCtx && limited.length > 0 ? (
        <>
          <div
            className="website-products-grid"
            style={{ gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))` }}
          >
            {limited.map((product) => (
              <WebsiteProductCard key={product.id} product={product} />
            ))}
          </div>
          {limited.length < displayProducts.length && (
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#5f6368' }}>
              Showing {limited.length} of {displayProducts.length} products
            </p>
          )}
          <p style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to={storeCtx.collectionPath} style={{ color: '#1a73e8', fontWeight: 500 }}>
              Browse full catalogue →
            </Link>
          </p>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, gap: '16px' }}>
          {Array(Math.min(settings.itemsToShow, 8))
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                }}
              >
                <IconImage size={40} style={{ marginBottom: 8, color: '#9ca3af' }} />
                <p style={{ margin: '0 0 6px 0', fontWeight: 500, fontSize: '0.875rem' }}>
                  {editMode ? 'Products appear on live store' : `Product ${i + 1}`}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
