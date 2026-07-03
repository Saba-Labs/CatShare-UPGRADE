import type { FeatureCardSection, ThemeSettings } from '../../../types/homepage';
import { getThemeButtonStyles, SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
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
  const buttonStyles = getThemeButtonStyles(theme || {});
  const { settings, content } = section;
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
              <h3
                className="sites-inline-editable"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateContent({ title: e.currentTarget.textContent || '' })}
              >
                {content.title}
              </h3>
              <p
                className="sites-inline-editable"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateContent({ description: e.currentTarget.textContent || '' })}
              >
                {content.description}
              </p>
              {content.buttonText && (
                <div className="button-group">
                  <span
                    className={`sites-inline-editable ${SITES_THEME_BUTTON_CLASS}`}
                    style={buttonStyles}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateContent({ buttonText: e.currentTarget.textContent || '' })}
                  >
                    {content.buttonText}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <h3>{content.title}</h3>
              <p>{content.description}</p>
              {content.buttonText && content.buttonLink && (
                <div className="button-group">
                  <StorefrontLink
                    href={content.buttonLink}
                    preview={builderCanvas}
                    className={SITES_THEME_BUTTON_CLASS}
                    style={buttonStyles}
                  >
                    {content.buttonText}
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
