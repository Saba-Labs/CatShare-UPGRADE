import React from 'react';
import { FeatureCardSection } from '../../../types/homepage';
import './FeatureCard.css';

interface FeatureCardSectionViewProps {
  section: FeatureCardSection & { id: string };
  editMode?: boolean;
}

export default function FeatureCardSectionView({ section, editMode }: FeatureCardSectionViewProps) {
  const { settings, content } = section;
  const isImageLeft = settings.layout === 'image-left';
  const layoutClass = isImageLeft ? 'layout-image-left' : 'layout-image-right';

  return (
    <div
      className="feature-card-section"
      style={{
        backgroundColor: settings.backgroundColor,
        color: settings.textColor,
        padding:
          settings.padding === 'small'
            ? '1.5rem'
            : settings.padding === 'large'
              ? '3rem'
              : '2rem',
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
          <h3>{content.title}</h3>
          <p>{content.description}</p>
          {content.buttonText && (
            <div className="button-group">
              <a href={content.buttonLink || '#'} className="feature-card-button">
                {content.buttonText}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
