import React from 'react';
import { TestimonialsSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';

interface TestimonialsSectionViewProps {
  section: TestimonialsSection & { id: string };
  editMode?: boolean;
}

export default function TestimonialsSectionView({ section, editMode }: TestimonialsSectionViewProps) {
  const { settings, content } = section;

  return (
    <div style={{ background: settings.backgroundColor || 'transparent', padding: '20px', borderRadius: '8px' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: 600, textAlign: 'center' }}>
        {settings.title}
      </h2>

      {content.testimonials.length === 0 ? (
        <SectionPlaceholder
          title="Testimonials"
          icon="💬"
          description={editMode ? 'Add testimonials in the properties panel' : 'No testimonials added'}
          editMode={editMode}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${settings.columns}, 1fr)`,
            gap: '20px',
          }}
        >
          {content.testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              style={{
                background: '#f9fafb',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
              }}
            >
              {settings.showRating && <div style={{ marginBottom: '12px', fontSize: '1.25rem' }}>⭐⭐⭐⭐⭐</div>}
              <p style={{ margin: '0 0 12px 0', fontStyle: 'italic', color: '#6b7280' }}>"{testimonial.text}"</p>
              <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>- {testimonial.author}</p>
              {testimonial.role && <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{testimonial.role}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
