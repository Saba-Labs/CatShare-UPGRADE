import React from 'react';
import { VideoSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import { IconVideo } from '../../Storefront/StorefrontIcons';
import './VideoSection.css';

interface VideoSectionViewProps {
  section: VideoSection & { id: string };
  editMode?: boolean;
}

export default function VideoSectionView({ section }: VideoSectionViewProps) {
  const { settings, content } = section;

  const widthClass =
    settings.width === 'small'
      ? 'video-section__inner--width-small'
      : settings.width === 'large'
        ? 'video-section__inner--width-large'
        : settings.width === 'full'
          ? 'video-section__inner--width-full'
          : 'video-section__inner--width-medium';
  const ratioClass = settings.aspectRatio === '4:3' ? 'video-section--ratio-4-3' : '';

  return (
    <div className={`video-section ${ratioClass}`}>
      <div className={widthClass}>
        {content.videoUrl ? (
          <iframe
            src={content.videoUrl}
            className="video-section__frame"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Video"
          />
        ) : (
          <SectionPlaceholder title="Video Section" icon={<IconVideo size={48} />} description="Add a video URL in the properties panel" />
        )}
      </div>
    </div>
  );
}
