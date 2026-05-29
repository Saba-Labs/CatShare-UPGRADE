import React from 'react';
import { Link } from 'react-router-dom';
import { FeaturedProductsSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import WebsiteProductCard from '../../WebsiteBuilder/WebsiteProductCard';
import { IconImage, IconShoppingBag } from '../../Storefront/StorefrontIcons';

interface FeaturedProductsSectionViewProps {
  section: FeaturedProductsSection & { id: string };
  editMode?: boolean;
}

export default function FeaturedProductsSectionView({ section, editMode }: FeaturedProductsSectionViewProps) {
  const { settings, content } = section;
  const storeCtx = useWebsiteStoreOptional();

  const resolvedProducts = storeCtx
    ? content.productIds
        .map((id) => storeCtx.products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
    : [];

  return (
    <div className="website-section-products" style={{ background: settings.backgroundColor || 'transparent' }}>
      <h2>{settings.title}</h2>
      {content.productIds.length === 0 ? (
        <SectionPlaceholder
          title="Featured Products"
          icon={<IconShoppingBag size={48} />}
          description={editMode ? 'Select products in the properties panel' : 'No products selected'}
          editMode={editMode}
        />
      ) : storeCtx && resolvedProducts.length > 0 ? (
        <>
          <div
            className="website-products-grid"
            style={{ gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))` }}
          >
            {resolvedProducts.slice(0, settings.itemsPerPage).map((product) => (
              <WebsiteProductCard key={product.id} product={product} />
            ))}
          </div>
          <p style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to={storeCtx.collectionPath} style={{ color: '#1a73e8', fontWeight: 500 }}>
              View all products →
            </Link>
          </p>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, gap: '16px' }}>
          {Array(Math.min(settings.itemsPerPage, content.productIds.length))
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                }}
              >
                <IconImage size={40} style={{ marginBottom: 8, color: '#9ca3af' }} />
                <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Product {i + 1}</p>
                {settings.showPrice && <p style={{ margin: 0, color: '#2563eb', fontWeight: 600 }}>—</p>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
