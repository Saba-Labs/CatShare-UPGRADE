import React from 'react';
import { ContentGridSection } from '../../../types/homepage';
import './ContentGrid.css';

interface ContentGridSectionViewProps {
  section: ContentGridSection & { id: string };
  editMode?: boolean;
}

export default function ContentGridSectionView({ section, editMode }: ContentGridSectionViewProps) {
  const { settings, content } = section;
  const paddingValue =
    settings.padding === 'small' ? '1.5rem' : settings.padding === 'large' ? '3rem' : '2rem';
  const gapValue = settings.gap === 'small' ? '1rem' : settings.gap === 'large' ? '2rem' : '1.5rem';

  return (
    <div
      className="content-grid-section"
      style={{
        backgroundColor: settings.backgroundColor,
        padding: paddingValue,
      }}
    >
      {settings.title && <h2 className="grid-title">{settings.title}</h2>}

      <div
        className="grid-container"
        style={{
          gridTemplateColumns: `repeat(${settings.columns}, 1fr)`,
          gap: gapValue,
        }}
      >
        {content.items.map((item) => (
          <div key={item.id} className="grid-item">
            <div className="grid-item-image">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} />
              ) : (
                <div className="image-placeholder">Image</div>
              )}
            </div>
            <div className="grid-item-content">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
