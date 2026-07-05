import type { FeatureCardSection, ThemeSettings } from '../../../types/homepage';
import { getBuilderButtonStyles } from '../../../utils/buttonStyleUtils';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import { useBuilderMediaOptional } from '../media/BuilderMediaContext';
import './FeatureCard.css';

interface FeatureCardSectionViewProps {
  section: FeatureCardSection & { id: string };
  theme?: ThemeSettings;
  storeId?: string;
  editMode?: boolean;
  builderCanvas?: boolean;
  onUpdateSection?: (updates: Partial<FeatureCardSection>) => void;
}

export default function FeatureCardSectionView({
  section,
  theme,
  storeId,
  editMode,
  builderCanvas = false,
  onUpdateSection,
}: FeatureCardSectionViewProps) {
  const { settings, content } = section;
  const buttonStyles = getBuilderButtonStyles(settings as Parameters<typeof getBuilderButtonStyles>[0], theme || {});
  const isImageLeft = settings.layout === 'image-left';
  const layoutClass = isImageLeft ? 'layout-image-left' : 'layout-image-right';
  const media = useBuilderMediaOptional();

  const updateContent = (patch: Partial<FeatureCardSection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  const openImagePicker = () => {
    if (!media || !storeId || !onUpdateSection) return;
    media.openMediaPicker({
      storeId,
      assetKey: `${section.id}-feature-image`,
      title: 'Choose image',
      onSelect: (url) => updateContent({ imageUrl: url }),
    });
  };

  return (
    <div
      className={`feature-card-section sites-section-pad--${settings.padding === 'small' ? 'small' : settings.padding === 'large' ? 'large' : 'medium'}`}
      style={{
        backgroundColor: settings.backgroundColor,
        color: settings.textColor,
      }}
    >
      <div className={`feature-card-content ${layoutClass}`}>
        <div className="feature-card-image">
          {content.imageUrl ? (
            <img
              src={content.imageUrl}
              alt={content.title}
              style={{ cursor: editMode && media ? 'pointer' : undefined }}
              onClick={editMode && media ? openImagePicker : undefined}
              title={editMode ? 'Click to change image' : undefined}
            />
          ) : (
            <button
              type="button"
              className="image-placeholder image-placeholder--btn"
              disabled={!editMode || !media}
              onClick={editMode ? openImagePicker : undefined}
            >
              {editMode ? '+ Add image' : 'Image'}
            </button>
          )}
          {editMode && media && content.imageUrl ? (
            <button type="button" className="section-image-edit-btn section-image-edit-btn--on-image" onClick={openImagePicker}>
              Change image
            </button>
          ) : null}
        </div>

        <div className="feature-card-text">
          {editMode && onUpdateSection ? (
            <>
              <BuilderInlineEditable
                tag="h3"
                value={content.title}
                onChange={(title) => updateContent({ title })}
              />
              <BuilderInlineEditable
                tag="p"
                value={content.description}
                onChange={(description) => updateContent({ description })}
              />
              {content.buttonText && (
                <div className="button-group">
                  <BuilderInlineEditable
                    tag="span"
                    className={SITES_THEME_BUTTON_CLASS}
                    style={buttonStyles}
                    value={content.buttonText}
                    onChange={(buttonText) => updateContent({ buttonText })}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <h3>
                <BuilderHtmlContent html={content.title} tag="span" />
              </h3>
              <p>
                <BuilderHtmlContent html={content.description} tag="span" />
              </p>
              {content.buttonText && content.buttonLink && (
                <div className="button-group">
                  <StorefrontLink
                    href={content.buttonLink}
                    preview={builderCanvas}
                    className={SITES_THEME_BUTTON_CLASS}
                    style={buttonStyles}
                  >
                    <BuilderHtmlContent html={content.buttonText} tag="span" />
                  </StorefrontLink>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
