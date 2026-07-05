import type { BannerSection, ThemeSettings } from '../../../types/homepage';
import { getBuilderButtonStyles } from '../../../utils/buttonStyleUtils';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
import { SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import { useBuilderMediaOptional } from '../media/BuilderMediaContext';
import './BannerSection.css';

interface BannerSectionViewProps {
  section: BannerSection & { id: string };
  theme?: ThemeSettings;
  storeId?: string;
  editMode?: boolean;
  builderCanvas?: boolean;
  onUpdateSection?: (updates: Partial<BannerSection>) => void;
}

const HEIGHT_MAP = { small: '150px', medium: '250px', large: '400px' } as const;

export default function BannerSectionView({
  section,
  theme,
  storeId,
  editMode,
  builderCanvas = false,
  onUpdateSection,
}: BannerSectionViewProps) {
  const { settings, content } = section;
  const media = useBuilderMediaOptional();
  const buttonStyles = getBuilderButtonStyles(settings as Parameters<typeof getBuilderButtonStyles>[0], theme || {});
  const align = settings.textAlignment || 'center';
  const canEdit = Boolean(editMode && onUpdateSection);

  const updateContent = (patch: Partial<BannerSection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  const openBackgroundPicker = () => {
    if (!media || !storeId || !onUpdateSection) return;
    media.openMediaPicker({
      storeId,
      assetKey: `${section.id}-banner-bg`,
      title: 'Choose background image',
      onSelect: (url) =>
        onUpdateSection({
          settings: { ...settings, backgroundImage: url },
        }),
    });
  };

  const renderButtonLabel = () => {
    if (canEdit) {
      return (
        <BuilderInlineEditable
          tag="span"
          value={content.buttonText || ''}
          placeholder="Button"
          onChange={(buttonText) => updateContent({ buttonText })}
        />
      );
    }
    return <BuilderHtmlContent html={content.buttonText} tag="span" />;
  };

  return (
    <div
      className={`banner-section banner-section--align-${align}`}
      style={{
        ['--banner-min-height' as string]: HEIGHT_MAP[settings.height],
        backgroundColor: settings.backgroundColor || '#1a73e8',
        backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined,
      }}
    >
      <div
        className="banner-section__overlay"
        style={{ background: `rgba(0,0,0,${settings.overlayOpacity})` }}
      />
      {canEdit && media && storeId ? (
        <button
          type="button"
          className="section-image-edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            openBackgroundPicker();
          }}
        >
          {settings.backgroundImage ? 'Change background' : '+ Add background image'}
        </button>
      ) : null}
      <div className="banner-section__content">
        <h2 className="banner-section__title">
          {canEdit ? (
            <BuilderInlineEditable
              tag="span"
              value={content.title}
              placeholder="Title"
              onChange={(title) => updateContent({ title })}
            />
          ) : (
            <BuilderHtmlContent html={content.title} tag="span" />
          )}
        </h2>
        {(canEdit || content.subtitle) && (
          <p className="banner-section__subtitle">
            {canEdit ? (
              <BuilderInlineEditable
                tag="span"
                value={content.subtitle || ''}
                placeholder="Subtitle"
                onChange={(subtitle) => updateContent({ subtitle })}
              />
            ) : (
              <BuilderHtmlContent html={content.subtitle} tag="span" />
            )}
          </p>
        )}
        {(canEdit || content.buttonText) &&
          (canEdit ? (
            <span className={`banner-section__cta ${SITES_THEME_BUTTON_CLASS}`} style={buttonStyles}>
              {renderButtonLabel()}
            </span>
          ) : content.buttonLink ? (
            <StorefrontLink
              href={content.buttonLink}
              preview={builderCanvas}
              className={`banner-section__cta ${SITES_THEME_BUTTON_CLASS}`}
              style={buttonStyles}
            >
              {renderButtonLabel()}
            </StorefrontLink>
          ) : (
            <span className={`banner-section__cta ${SITES_THEME_BUTTON_CLASS}`} style={buttonStyles}>
              {renderButtonLabel()}
            </span>
          ))}
      </div>
    </div>
  );
}
