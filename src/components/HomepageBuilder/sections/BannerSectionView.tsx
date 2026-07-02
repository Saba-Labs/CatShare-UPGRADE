import type { BannerSection, ThemeSettings } from '../../../types/homepage';
import { getThemeButtonStyles, SITES_THEME_BUTTON_CLASS } from '../../../utils/themeButtonStyles';
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
  const align = settings.textAlignment || 'center';

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
      {editMode && media && storeId && onUpdateSection ? (
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
        {editMode && onUpdateSection ? (
          <>
            <h2
              className="banner-section__title sites-inline-editable sites-inline-heading"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateContent({ title: e.currentTarget.textContent || '' })}
            >
              {content.title}
            </h2>
            <p
              className="banner-section__subtitle sites-inline-editable"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateContent({ subtitle: e.currentTarget.textContent || '' })}
            >
              {content.subtitle || 'Subtitle'}
            </p>
            <span
              className={`banner-section__cta sites-inline-editable ${SITES_THEME_BUTTON_CLASS}`}
              style={getThemeButtonStyles(theme || {})}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateContent({ buttonText: e.currentTarget.textContent || '' })}
            >
              {content.buttonText || 'Button'}
            </span>
          </>
        ) : (
          <>
            <h2 className="banner-section__title">{content.title}</h2>
            {content.subtitle ? <p className="banner-section__subtitle">{content.subtitle}</p> : null}
            {content.buttonText ? (
              content.buttonLink ? (
                <StorefrontLink
                  href={content.buttonLink}
                  preview={builderCanvas}
                  className={`banner-section__cta ${SITES_THEME_BUTTON_CLASS}`}
                  style={getThemeButtonStyles(theme || {})}
                >
                  {content.buttonText}
                </StorefrontLink>
              ) : (
                <span className={`banner-section__cta ${SITES_THEME_BUTTON_CLASS}`} style={getThemeButtonStyles(theme || {})}>
                  {content.buttonText}
                </span>
              )
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
