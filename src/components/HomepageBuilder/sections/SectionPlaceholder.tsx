import type { ReactNode } from 'react';
import './SectionPlaceholder.css';

interface SectionPlaceholderProps {
  title: string;
  icon: ReactNode;
  description?: string;
  editMode?: boolean;
}

export default function SectionPlaceholder({ title, icon, description, editMode }: SectionPlaceholderProps) {
  return (
    <div className="section-placeholder">
      <div className="section-placeholder__icon">{icon}</div>
      <h3 className="section-placeholder__title">{title}</h3>
      {description && (
        <p className="section-placeholder__description">{editMode ? description : 'Section preview'}</p>
      )}
    </div>
  );
}
