import type { Testimonial, TestimonialsSection } from '../../../types/homepage';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
import SectionPlaceholder from './SectionPlaceholder';
import { IconMessage } from '../../Storefront/StorefrontIcons';
import TestimonialStarRating, { normalizeTestimonialRating } from './TestimonialStarRating';
import TestimonialsCarousel from './TestimonialsCarousel';
import {
  buildTestimonialSectionClassName,
  getFeaturedTestimonialIndex,
  getLayeredCardColor,
  getTestimonialInitials,
  normalizeTestimonialCardStyle,
  resolveTestimonialSectionSettings,
} from '../../../utils/testimonialCardStyles';
import './testimonials-section.css';

interface TestimonialsSectionViewProps {
  section: TestimonialsSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TestimonialsSection>) => void;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
  showRating: boolean;
  cardStyle: ReturnType<typeof normalizeTestimonialCardStyle>;
  index: number;
  featured: boolean;
  layerColor?: string;
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<TestimonialsSection>) => void;
  content: TestimonialsSection['content'];
}

function TestimonialAvatar({ image, author }: { image?: string; author: string }) {
  const initials = getTestimonialInitials(author);
  if (image) {
    return <img className="testimonial-card__avatar" src={image} alt="" loading="lazy" />;
  }
  return (
    <span className="testimonial-card__avatar testimonial-card__avatar--initials" aria-hidden>
      {initials}
    </span>
  );
}

function TestimonialStarsBlock({
  showRating,
  rating,
  editMode,
  onChange,
}: {
  showRating: boolean;
  rating: number;
  editMode?: boolean;
  onChange?: (rating: number) => void;
}) {
  if (!showRating || rating <= 0) return null;
  return (
    <div className="testimonial-card__stars">
      {editMode && onChange ? (
        <TestimonialStarRating rating={rating} interactive onChange={onChange} />
      ) : (
        <TestimonialStarRating rating={rating} />
      )}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  showRating,
  cardStyle,
  index,
  featured,
  layerColor,
  editMode,
  onUpdateSection,
  content,
}: TestimonialCardProps) {
  const patchTestimonial = (patch: Partial<Testimonial>) => {
    if (!onUpdateSection) return;
    const testimonials = content.testimonials.map((t) =>
      t.id === testimonial.id ? { ...t, ...patch } : t
    );
    onUpdateSection({ content: { testimonials } });
  };

  const rating = normalizeTestimonialRating(testimonial.rating);
  const stars = (
    <TestimonialStarsBlock
      showRating={showRating}
      rating={rating}
      editMode={editMode}
      onChange={editMode && onUpdateSection ? (next) => patchTestimonial({ rating: next }) : undefined}
    />
  );

  const authorBlock =
    editMode && onUpdateSection ? (
      <BuilderInlineEditable
        tag="p"
        className="testimonial-card__author"
        value={testimonial.author}
        onChange={(author) => patchTestimonial({ author })}
      />
    ) : (
      <p className="testimonial-card__author">
        <BuilderHtmlContent html={testimonial.author} tag="span" />
      </p>
    );

  const roleBlock =
    editMode && onUpdateSection ? (
      <BuilderInlineEditable
        tag="p"
        className="testimonial-card__role"
        value={testimonial.role || 'Verified buyer'}
        onChange={(role) => patchTestimonial({ role })}
      />
    ) : testimonial.role ? (
      <p className="testimonial-card__role">
        <BuilderHtmlContent html={testimonial.role} tag="span" />
      </p>
    ) : null;

  const quoteBlock =
    editMode && onUpdateSection ? (
      <BuilderInlineEditable
        tag="p"
        className="testimonial-card__quote"
        value={testimonial.text}
        onChange={(text) => patchTestimonial({ text })}
      />
    ) : (
      <p className="testimonial-card__quote">
        {cardStyle === 'classic' ? (
          <>
            &ldquo;<BuilderHtmlContent html={testimonial.text} tag="span" />&rdquo;
          </>
        ) : (
          <BuilderHtmlContent html={testimonial.text} tag="span" />
        )}
      </p>
    );

  if (cardStyle === 'layered') {
    return (
      <div
        className="testimonial-card testimonial-card--layered"
        data-layer-index={String(index % 3)}
        style={{ ['--testimonial-layer-color' as string]: layerColor }}
      >
        <div className="testimonial-card__layer" aria-hidden />
        <div className="testimonial-card__surface">
          <div className="testimonial-card__avatar-wrap">
            <TestimonialAvatar image={testimonial.image} author={testimonial.author} />
          </div>
          {authorBlock}
          {roleBlock}
          {quoteBlock}
          {stars}
          {featured ? (
            <div className="testimonial-card__badge" aria-hidden>
              ★
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (cardStyle === 'accent') {
    return (
      <div
        className={`testimonial-card testimonial-card--accent${featured ? ' is-featured' : ''}`}
      >
        <div className="testimonial-card__avatar-wrap">
          <TestimonialAvatar image={testimonial.image} author={testimonial.author} />
        </div>
        {authorBlock}
        {roleBlock}
        {quoteBlock}
        {stars}
      </div>
    );
  }

  return (
    <div className="testimonial-card testimonial-card--classic">
      {stars}
      {quoteBlock}
      {authorBlock}
      {roleBlock}
    </div>
  );
}

export default function TestimonialsSectionView({ section, editMode, onUpdateSection }: TestimonialsSectionViewProps) {
  const resolved = resolveTestimonialSectionSettings(section.settings);
  const { content } = section;
  const cardStyle = resolved.cardStyle;
  const featuredIndex = getFeaturedTestimonialIndex(content.testimonials.length);

  const updateSettings = (patch: Partial<TestimonialsSection['settings']>) => {
    onUpdateSection?.({ settings: { ...section.settings, ...patch } });
  };

  const cards = content.testimonials.map((testimonial, index) => (
    <TestimonialCard
      key={testimonial.id}
      testimonial={testimonial}
      showRating={resolved.showRating}
      cardStyle={cardStyle}
      index={index}
      featured={index === featuredIndex}
      layerColor={getLayeredCardColor(index)}
      editMode={editMode}
      onUpdateSection={onUpdateSection}
      content={content}
    />
  ));

  const cardList =
    resolved.displayMode === 'grid' ? (
      <div
        className="testimonials-grid"
        style={{ ['--testimonial-cols' as string]: resolved.columns }}
      >
        {cards}
      </div>
    ) : (
      <TestimonialsCarousel>{cards}</TestimonialsCarousel>
    );

  return (
    <div
      className={`testimonials-section ${buildTestimonialSectionClassName(cardStyle)}`}
      style={{
        background: resolved.backgroundColor || 'transparent',
        ['--testimonial-cols' as string]: resolved.columns,
        ['--testimonial-accent' as string]: resolved.accentColor,
      }}
    >
      {editMode && onUpdateSection ? (
        <BuilderInlineEditable
          tag="h2"
          className="testimonials-section__title sites-inline-heading"
          value={resolved.title}
          onChange={(title) => updateSettings({ title })}
        />
      ) : (
        <h2 className="testimonials-section__title">
          <BuilderHtmlContent html={resolved.title} tag="span" />
        </h2>
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
