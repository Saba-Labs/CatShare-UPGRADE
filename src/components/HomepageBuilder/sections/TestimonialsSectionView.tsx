import type { Testimonial, TestimonialsSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import { IconMessage } from '../../Storefront/StorefrontIcons';
import TestimonialStarRating, { normalizeTestimonialRating } from './TestimonialStarRating';
import TestimonialsCarousel from './TestimonialsCarousel';
import './testimonials-section.css';

interface TestimonialsSectionViewProps {
  section: TestimonialsSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TestimonialsSection>) => void;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
  showRating: boolean;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TestimonialsSection>) => void;
  content: TestimonialsSection['content'];
}

function TestimonialCard({ testimonial, showRating, editMode, onUpdateSection, content }: TestimonialCardProps) {
  const patchTestimonial = (patch: Partial<Testimonial>) => {
    if (!onUpdateSection) return;
    const testimonials = content.testimonials.map((t) =>
      t.id === testimonial.id ? { ...t, ...patch } : t
    );
    onUpdateSection({ content: { testimonials } });
  };

  const rating = normalizeTestimonialRating(testimonial.rating);

  return (
    <div className="testimonial-card">
      {showRating && rating > 0 && (
        <div className="testimonial-card__stars">
          {editMode && onUpdateSection ? (
            <TestimonialStarRating
              rating={rating}
              interactive
              onChange={(next) => patchTestimonial({ rating: next })}
            />
          ) : (
            <TestimonialStarRating rating={rating} />
          )}
        </div>
      )}
      {editMode && onUpdateSection ? (
        <>
          <p
            className="testimonial-card__quote sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => patchTestimonial({ text: e.currentTarget.textContent || '' })}
          >
            {testimonial.text}
          </p>
          <p
            className="testimonial-card__author sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => patchTestimonial({ author: e.currentTarget.textContent || '' })}
          >
            {testimonial.author}
          </p>
          <p
            className="testimonial-card__role sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => patchTestimonial({ role: e.currentTarget.textContent || '' })}
          >
            {testimonial.role || 'Verified buyer'}
          </p>
        </>
      ) : (
        <>
          <p className="testimonial-card__quote">&ldquo;{testimonial.text}&rdquo;</p>
          <p className="testimonial-card__author">{testimonial.author}</p>
          {testimonial.role ? <p className="testimonial-card__role">{testimonial.role}</p> : null}
        </>
      )}
    </div>
  );
}

export default function TestimonialsSectionView({ section, editMode, onUpdateSection }: TestimonialsSectionViewProps) {
  const { settings, content } = section;

  const updateSettings = (patch: Partial<TestimonialsSection['settings']>) => {
    onUpdateSection?.({ settings: { ...settings, ...patch } });
  };

  const cards = content.testimonials.map((testimonial) => (
    <TestimonialCard
      key={testimonial.id}
      testimonial={testimonial}
      showRating={settings.showRating}
      editMode={editMode}
      onUpdateSection={onUpdateSection}
      content={content}
    />
  ));

  const cardList =
    settings.displayMode === 'grid' ? (
      <div
        className="testimonials-grid"
        style={{ ['--testimonial-cols' as string]: settings.columns }}
      >
        {cards}
      </div>
    ) : (
      <TestimonialsCarousel>{cards}</TestimonialsCarousel>
    );

  return (
    <div
      className="testimonials-section"
      style={{
        background: settings.backgroundColor || 'transparent',
        ['--testimonial-cols' as string]: settings.columns,
      }}
    >
      {editMode && onUpdateSection ? (
        <h2
          className="testimonials-section__title sites-inline-editable sites-inline-heading"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => updateSettings({ title: e.currentTarget.textContent || '' })}
        >
          {settings.title}
        </h2>
      ) : (
        <h2 className="testimonials-section__title">{settings.title}</h2>
      )}

      {content.testimonials.length === 0 ? (
        <SectionPlaceholder
          title="Testimonials"
          icon={<IconMessage size={48} />}
          description={editMode ? 'Add testimonials in the properties panel' : 'No testimonials added'}
          editMode={editMode}
        />
      ) : (
        cardList
      )}
    </div>
  );
}
