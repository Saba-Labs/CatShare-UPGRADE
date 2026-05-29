import React from 'react';
import { VideoSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import { IconVideo } from '../../Storefront/StorefrontIcons';

interface VideoSectionViewProps {
  section: VideoSection & { id: string };
  editMode?: boolean;
}

export default function VideoSectionView({ section }: VideoSectionViewProps) {
  const { settings, content } = section;

  const widthMap = { small: '30%', medium: '50%', large: '80%', full: '100%' };
  const width = widthMap[settings.width];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div style={{ width }}>
        {content.videoUrl ? (
          <iframe
            src={content.videoUrl}
            width="100%"
            height={settings.aspectRatio === '16:9' ? 400 : settings.aspectRatio === '4:3' ? 300 : 300}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ borderRadius: '8px' }}
          />
        ) : (
          <SectionPlaceholder title="Video Section" icon={<IconVideo size={48} />} description="Add a video URL in the properties panel" />
        )}
      </div>
    </div>
  );
}
