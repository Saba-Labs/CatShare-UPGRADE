import React from 'react';
import { TwoColumnContentSection } from '../../../types/homepage';
import './TwoColumnContent.css';

interface TwoColumnContentSectionViewProps {
  section: TwoColumnContentSection & { id: string };
  editMode?: boolean;
}

export default function TwoColumnContentSectionView({
  section,
  editMode,
}: TwoColumnContentSectionViewProps) {
  const { settings, content } = section;
  const paddingValue =
    settings.padding === 'small' ? '1.5rem' : settings.padding === 'large' ? '3rem' : '2rem';
  const gapValue = settings.gap === 'small' ? '1rem' : settings.gap === 'large' ? '2rem' : '1.5rem';

  return (
    <div
      className="two-column-section"
      style={{
        backgroundColor: settings.backgroundColor,
        padding: paddingValue,
      }}
    >
      <div className="two-column-container" style={{ gap: gapValue }}>
        {/* Left Column */}
        <div className="column">
          {content.leftContent.imageUrl && (
            <div className="column-image">
              <img src={content.leftContent.imageUrl} alt={content.leftContent.title} />
            </div>
          )}
          <h3>{content.leftContent.title}</h3>
          <p>{content.leftContent.description}</p>
        </div>

        {/* Right Column */}
        <div className="column">
          {content.rightContent.imageUrl && (
            <div className="column-image">
              <img src={content.rightContent.imageUrl} alt={content.rightContent.title} />
            </div>
          )}
          <h3>{content.rightContent.title}</h3>
          <p>{content.rightContent.description}</p>
        </div>
      </div>
    </div>
  );
}
