import React from 'react';
import { HomepageSection } from '../../../types/homepage';
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

interface SectionRendererProps {
  section: HomepageSection & { id: string };
  editMode?: boolean;
}

export default function SectionRenderer({ section, editMode = false }: SectionRendererProps) {
  const commonProps = { section, editMode };

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
    default:
      return (
        <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '8px', color: '#dc2626' }}>
          Unknown section type: {(section as any).type}
        </div>
      );
  }
}
