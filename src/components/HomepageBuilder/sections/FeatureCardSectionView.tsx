import React from 'react';
import { FeatureCardSection } from '../../../types/homepage';
import './FeatureCard.css';

interface FeatureCardSectionViewProps {
  section: FeatureCardSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<FeatureCardSection>) => void;
}

export default function FeatureCardSectionView({ section, editMode, onUpdateSection }: FeatureCardSectionViewProps) {
  const { settings, content } = section;
  const isImageLeft = settings.layout === 'image-left';
  const layoutClass = isImageLeft ? 'layout-image-left' : 'layout-image-right';

  const updateContent = (patch: Partial<FeatureCardSection['content']>) => {
    onUpdateSection?.({ content: { ...content, ...patch } });
  };

  return (
    <div
      className="feature-card-section"
      style={{
        backgroundColor: settings.backgroundColor,
        color: settings.textColor,
        padding:
          settings.padding === 'small' ? '1.5rem' : settings.padding === 'large' ? '3rem' : '2rem',
      }}
    >
      <div className={`feature-card-content ${layoutClass}`}>
        <div className="feature-card-image">
          {content.imageUrl ? (
            <img src={content.imageUrl} alt={content.title} />
          ) : (
            <div className="image-placeholder">Image</div>
          )}
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
                <span
                  className="sites-inline-editable feature-card-button"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateContent({ buttonText: e.currentTarget.textContent || '' })}
                >
                  {content.buttonText}
                </span>
              )}
            </>
          ) : (
            <>
              <h3>{content.title}</h3>
              <p>{content.description}</p>
              {content.buttonText && (
                <div className="button-group">
                  <a href={content.buttonLink || '#'} className="feature-card-button">
                    {content.buttonText}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
