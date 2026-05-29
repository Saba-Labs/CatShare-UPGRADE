import type { ReactNode } from 'react';

interface SectionPlaceholderProps {
  title: string;
  icon: ReactNode;
  description?: string;
  editMode?: boolean;
}

export default function SectionPlaceholder({ title, icon, description, editMode }: SectionPlaceholderProps) {
  return (
    <div style={{ background: '#f3f4f6', padding: '32px 20px', borderRadius: '8px', textAlign: 'center', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ marginBottom: '12px', color: '#9ca3af', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <h3 style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '1rem' }}>{title}</h3>
      {description && (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          {editMode ? description : 'Section preview'}
        </p>
      )}
    </div>
  );
}
