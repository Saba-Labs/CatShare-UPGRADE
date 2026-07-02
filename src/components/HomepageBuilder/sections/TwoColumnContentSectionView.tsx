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

  return (
    <div
      className={`two-column-section sites-section-pad--${settings.padding === 'small' ? 'small' : settings.padding === 'large' ? 'large' : 'medium'}`}
      style={{
        backgroundColor: settings.backgroundColor,
      }}
    >
      <div className={`two-column-container two-column-container--gap-${settings.gap}`}>
        <div className="column">
          {content.leftContent.imageUrl && (
            <div className="column-image">
              <img src={content.leftContent.imageUrl} alt={content.leftContent.title} />
            </div>
          )}
          <h3>{content.leftContent.title}</h3>
          <p>{content.leftContent.description}</p>
        </div>

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
