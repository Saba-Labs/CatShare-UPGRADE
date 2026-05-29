/** Clamp testimonial rating to 0–5 (0 = hidden when showRating is on). */
export function normalizeTestimonialRating(rating: number | undefined): number {
  if (rating == null || Number.isNaN(rating)) return 5;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

interface TestimonialStarRatingProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function TestimonialStarRating({
  rating,
  size = 16,
  interactive = false,
  onChange,
}: TestimonialStarRatingProps) {
  const value = normalizeTestimonialRating(rating);

  return (
    <div
      className={`testimonial-stars${interactive ? ' testimonial-stars--interactive' : ''}`}
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? 'Star rating' : undefined}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starIndex = i + 1;
        const filled = starIndex <= value;
        return (
          <button
            key={i}
            type="button"
            className={`testimonial-star${filled ? ' testimonial-star--filled' : ''}`}
            disabled={!interactive}
            aria-label={interactive ? `${starIndex} star${starIndex === 1 ? '' : 's'}` : undefined}
            onClick={interactive && onChange ? () => onChange(starIndex) : undefined}
          >
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={filled ? '#f59e0b' : 'none'}
                stroke={filled ? 'none' : '#d1d5db'}
                strokeWidth={filled ? 0 : 1.5}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
