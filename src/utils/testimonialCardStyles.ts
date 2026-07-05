import type { TestimonialsSection } from '../types/homepage';

export type TestimonialCardStyle = NonNullable<TestimonialsSection['settings']['cardStyle']>;

export const TESTIMONIAL_CARD_STYLE_OPTIONS: { value: TestimonialCardStyle; label: string }[] = [
  { value: 'classic', label: 'Classic quote' },
  { value: 'layered', label: 'Layered cards' },
  { value: 'accent', label: 'Accent cards' },
];

const LAYERED_CARD_COLORS = ['#3b82f6', '#22c55e', '#0d9488'] as const;

export function normalizeTestimonialCardStyle(
  style: TestimonialsSection['settings']['cardStyle'] | undefined
): TestimonialCardStyle {
  if (style === 'layered' || style === 'accent') return style;
  return 'classic';
}

export function resolveTestimonialSectionSettings(
  settings: TestimonialsSection['settings']
): TestimonialsSection['settings'] & {
  cardStyle: TestimonialCardStyle;
  accentColor: string;
} {
  return {
    ...settings,
    cardStyle: normalizeTestimonialCardStyle(settings.cardStyle),
    accentColor: settings.accentColor || '#dc2626',
  };
}

export function buildTestimonialSectionClassName(cardStyle: TestimonialCardStyle): string {
  return `testimonials-section--style-${cardStyle}`;
}

export function getLayeredCardColor(index: number): string {
  return LAYERED_CARD_COLORS[index % LAYERED_CARD_COLORS.length];
}

/** Middle card is featured (star badge / accent border). */
export function getFeaturedTestimonialIndex(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 0;
  return Math.floor((count - 1) / 2);
}

export function getTestimonialInitials(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
