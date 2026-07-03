import type { WebsiteModeConfig, WebsiteCollectionTemplate } from '../../types/homepage';
import CollectionTemplateEditor from './editors/CollectionTemplateEditor';
import SidebarSection from './SidebarSection';
import { FiArrowLeft, FiGrid } from './builderSidebarIcons';
import { resolveCollectionTemplate } from '../../utils/collectionPageSettings';

interface CollectionTemplateQuickPanelProps {
  categoryLabel?: string;
  websiteConfig: WebsiteModeConfig;
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void;
  onBack: () => void;
}

function updateCollectionTemplate(
  websiteConfig: WebsiteModeConfig,
  patch: Partial<WebsiteCollectionTemplate>,
  onUpdateWebsiteConfig: (updates: Partial<WebsiteModeConfig>) => void
) {
  onUpdateWebsiteConfig({
    templates: {
      ...websiteConfig.templates,
      collection: { ...websiteConfig.templates.collection, ...patch },
    },
  });
}

export default function CollectionTemplateQuickPanel({
  categoryLabel,
  websiteConfig,
  onUpdateWebsiteConfig,
  onBack,
}: CollectionTemplateQuickPanelProps) {
  const template = resolveCollectionTemplate(websiteConfig);

  return (
    <div className="sidebar-panel">
      <div className="sidebar-panel-toolbar">
        <button type="button" className="btn-icon-action sidebar-back-btn" onClick={onBack} title="Back" aria-label="Back">
          <FiArrowLeft aria-hidden />
        </button>
        <div className="sidebar-panel-toolbar__head">
          <FiGrid className="sidebar-panel-toolbar__icon" aria-hidden />
          <h3 className="sidebar-panel-toolbar__title">Category page</h3>
        </div>
      </div>

      <p className="panel-hint" style={{ margin: '0 0 12px' }}>
        {categoryLabel
          ? `“${categoryLabel}” is a built-in store page with your full product catalog. Customize how products look below — the catalog cannot be removed.`
          : 'Category and shop pages always include your full product catalog. Customize how products look below.'}
      </p>

      <SidebarSection
        title="Product catalog"
        icon={<FiGrid />}
        description="Applies to every category and shop page"
      >
        <CollectionTemplateEditor
          template={template}
          onUpdate={(patch) =>
            updateCollectionTemplate(websiteConfig, patch, onUpdateWebsiteConfig)
          }
        />
      </SidebarSection>
    </div>
  );
}
