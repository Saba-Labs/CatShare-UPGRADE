import React from 'react';
import type { ProductWithCatalogueData } from '../../../config/catalogueProductUtils';
import { HomepageSection, ThemeSettings } from '../../../types/homepage';
import CarouselSectionView from './CarouselSectionView';
import TextSectionView from './TextSectionView';
import ImageSectionView from './ImageSectionView';
import BannerSectionView from './BannerSectionView';
import FeaturedProductsSectionView from './FeaturedProductsSectionView';
import CategoryShowcaseSectionView from './CategoryShowcaseSectionView';
import ProductGridSectionView from './ProductGridSectionView';
import AnnouncementSectionView from './AnnouncementSectionView';
import CTASectionView from './CTASectionView';
import VideoSectionView from './VideoSectionView';
import TestimonialsSectionView from './TestimonialsSectionView';
import FooterSectionView from './FooterSectionView';
import FeatureCardSectionView from './FeatureCardSectionView';
import TwoColumnContentSectionView from './TwoColumnContentSectionView';
import ContentGridSectionView from './ContentGridSectionView';
import DividerSectionView from './DividerSectionView';
import FaqSectionView from './FaqSectionView';
import EmbedSectionView from './EmbedSectionView';
import FreeformSectionView from './FreeformSectionView';
import type { FreeformElementType, FreeformSection } from '../../../types/homepage';

interface SectionRendererProps {
  section: HomepageSection & { id: string };
  theme?: ThemeSettings;
  storeId?: string;
  editMode?: boolean;
  selectedFreeformElementId?: string | null;
  onSelectFreeformElement?: (elementId: string | null) => void;
  onAddFreeformLayer?: (type: FreeformElementType) => void;
  onActivateFreeform?: () => void;
  onUpdateSection?: (updates: Partial<HomepageSection>) => void;
  builderCanvas?: boolean;
  onProductPreview?: (product: ProductWithCatalogueData) => void;
}

export default function SectionRenderer({
  section,
  theme,
  storeId,
  editMode = false,
  selectedFreeformElementId = null,
  onSelectFreeformElement,
  onAddFreeformLayer,
  onActivateFreeform,
  onUpdateSection,
  builderCanvas = false,
  onProductPreview,
}: SectionRendererProps) {
  const commonProps = { section, theme, storeId, editMode, onUpdateSection, builderCanvas, onProductPreview };

  switch (section.type) {
    case 'carousel':
      return <CarouselSectionView {...commonProps} section={section as any} />;
    case 'text':
      return <TextSectionView {...commonProps} section={section as any} />;
    case 'image':
      return <ImageSectionView {...commonProps} section={section as any} />;
    case 'banner':
      return <BannerSectionView {...commonProps} section={section as any} />;
    case 'featured-products':
      return <FeaturedProductsSectionView {...commonProps} section={section as any} />;
    case 'category-showcase':
      return <CategoryShowcaseSectionView {...commonProps} section={section as any} />;
    case 'product-grid':
      return <ProductGridSectionView {...commonProps} section={section as any} />;
    case 'announcement':
      return <AnnouncementSectionView {...commonProps} section={section as any} />;
    case 'cta':
      return <CTASectionView {...commonProps} section={section as any} />;
    case 'video':
      return <VideoSectionView {...commonProps} section={section as any} />;
    case 'testimonials':
      return <TestimonialsSectionView {...commonProps} section={section as any} />;
    case 'footer':
      return <FooterSectionView {...commonProps} section={section as any} />;
    case 'feature-card':
      return <FeatureCardSectionView {...commonProps} section={section as any} />;
    case 'two-column-content':
      return <TwoColumnContentSectionView {...commonProps} section={section as any} />;
    case 'content-grid':
      return <ContentGridSectionView {...commonProps} section={section as any} />;
    case 'divider':
      return <DividerSectionView section={section as any} />;
    case 'faq':
      return <FaqSectionView {...commonProps} section={section as any} />;
    case 'embed':
      return <EmbedSectionView {...commonProps} section={section as any} />;
    case 'freeform':
      return (
        <FreeformSectionView
          section={section as FreeformSection & { id: string }}
          theme={theme}
          storeId={storeId}
          editMode={editMode}
          selectedElementId={selectedFreeformElementId}
          onSelectElement={onSelectFreeformElement}
          onAddLayer={onAddFreeformLayer}
          onActivate={onActivateFreeform}
          onUpdateSection={onUpdateSection as (u: Partial<FreeformSection>) => void}
        />
      );
    default:
      return (
        <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '8px', color: '#dc2626' }}>
          Unknown section type: {(section as any).type}
        </div>
      );
  }
}
