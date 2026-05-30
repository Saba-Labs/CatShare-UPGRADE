import { HomepageSection, WebsiteModeConfig } from '../../types/homepage';
import { SECTION_TYPE_LABELS } from '../../config/homepageBuilderConfig';
import TextSectionEditor from './editors/TextSectionEditor';
import CarouselSectionEditor from './editors/CarouselSectionEditor';
import GenericSectionEditor from './editors/GenericSectionEditor';
import FaqSectionEditor from './editors/FaqSectionEditor';
import EmbedSectionEditor from './editors/EmbedSectionEditor';
import DividerSectionEditor from './editors/DividerSectionEditor';
import FeaturedProductsEditor from './editors/FeaturedProductsEditor';
import CategoryShowcaseEditor from './editors/CategoryShowcaseEditor';
import ProductGridEditor from './editors/ProductGridEditor';
import TestimonialsSectionEditor from './editors/TestimonialsSectionEditor';
import ContentGridSectionEditor from './editors/ContentGridSectionEditor';
import FreeformSectionEditor from './editors/FreeformSectionEditor';
import type { FreeformSection } from '../../types/homepage';
import FooterSettingsEditor from './FooterSettingsEditor';
import SectionStyleControls from './SectionStyleControls';
import SidebarSection from './SidebarSection';
import { FiArrowLeft, FiDroplet, FiSliders, SECTION_ICONS } from './builderSidebarIcons';

const CATALOGUE_SECTION_TYPES = ['featured-products', 'category-showcase', 'product-grid'];
const DEDICATED_EDITOR_TYPES = [
  'text',
  'carousel',
  'faq',
  'embed',
  'divider',
  'testimonials',
  'content-grid',
  'freeform',
  ...CATALOGUE_SECTION_TYPES,
];

interface SectionQuickPanelProps {
  section: HomepageSection & { id: string };
  storeId: string;
  websiteConfig?: WebsiteModeConfig;
  selectedFreeformElementId?: string | null;
  onSelectFreeformElement?: (id: string | null) => void;
  onUpdateWebsiteConfig?: (updates: Partial<WebsiteModeConfig>) => void;
  onUpdate: (updates: Partial<HomepageSection>) => void;
  onBack: () => void;
}

export default function SectionQuickPanel({
  section,
  storeId,
  websiteConfig,
  selectedFreeformElementId = null,
  onSelectFreeformElement,
  onUpdateWebsiteConfig,
  onUpdate,
  onBack,
}: SectionQuickPanelProps) {
  const SectionIcon = SECTION_ICONS[section.type];
  const sectionTitle = SECTION_TYPE_LABELS[section.type] || 'Section';

  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-toolbar">
        <button type="button" className="btn-icon-action sidebar-back-btn" onClick={onBack} title="Back" aria-label="Back">
          <FiArrowLeft aria-hidden />
        </button>
        <div className="sidebar-panel-toolbar__head">
          {SectionIcon ? <SectionIcon className="sidebar-panel-toolbar__icon" aria-hidden /> : null}
          <h3 className="sidebar-panel-toolbar__title">{sectionTitle}</h3>
        </div>
      </div>

      {section.type !== 'footer' && section.type !== 'freeform' && (
        <SidebarSection title="Style" icon={<FiDroplet />} description="Spacing, colors & layout">
          <SectionStyleControls section={section} onUpdate={onUpdate} />
        </SidebarSection>
      )}

      <SidebarSection
        title={section.type === 'footer' ? 'Footer' : 'Content'}
        icon={<FiSliders />}
        description="Block settings"
      >
        {section.type === 'footer' && websiteConfig && onUpdateWebsiteConfig && (
          <FooterSettingsEditor
            siteSettings={websiteConfig.siteSettings}
            websiteConfig={websiteConfig}
            onUpdateWebsiteConfig={onUpdateWebsiteConfig}
            embedded
          />
        )}
        {section.type === 'text' && <TextSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'carousel' && (
          <CarouselSectionEditor section={section as any} storeId={storeId} onUpdate={onUpdate} />
        )}
        {section.type === 'faq' && <FaqSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'embed' && <EmbedSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'divider' && <DividerSectionEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'featured-products' && (
          <FeaturedProductsEditor section={section as any} onUpdate={onUpdate} />
        )}
        {section.type === 'category-showcase' && (
          <CategoryShowcaseEditor
            section={section as any}
            storeId={storeId}
            websiteConfig={websiteConfig}
            onUpdate={onUpdate}
          />
        )}
        {section.type === 'product-grid' && <ProductGridEditor section={section as any} onUpdate={onUpdate} />}
        {section.type === 'testimonials' && (
          <TestimonialsSectionEditor section={section as any} onUpdate={onUpdate} />
        )}
        {section.type === 'content-grid' && (
          <ContentGridSectionEditor section={section as any} storeId={storeId} onUpdate={onUpdate} />
        )}
        {section.type === 'freeform' && onSelectFreeformElement && (
          <FreeformSectionEditor
            section={section as FreeformSection & { id: string }}
            storeId={storeId}
            selectedElementId={selectedFreeformElementId}
            onSelectElement={onSelectFreeformElement}
            onUpdate={onUpdate}
          />
        )}
        {section.type !== 'footer' && !DEDICATED_EDITOR_TYPES.includes(section.type) && (
          <GenericSectionEditor section={section} storeId={storeId} websiteConfig={websiteConfig} onUpdate={onUpdate} />
        )}
      </SidebarSection>
    </div>
  );
}
