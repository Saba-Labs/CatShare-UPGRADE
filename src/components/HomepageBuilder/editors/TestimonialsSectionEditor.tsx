import { v4 as uuid } from 'uuid';
import type { TestimonialsSection } from '../../../types/homepage';
import TestimonialStarRating from '../sections/TestimonialStarRating';
import SidebarDropdownField from '../SidebarDropdownField';
import '../sections/testimonials-section.css';

interface TestimonialsSectionEditorProps {
  section: TestimonialsSection & { id: string };
  onUpdate: (updates: Partial<TestimonialsSection>) => void;
}

export default function TestimonialsSectionEditor({ section, onUpdate }: TestimonialsSectionEditorProps) {
  const { settings, content } = section;

  const updateSettings = (patch: Partial<TestimonialsSection['settings']>) => {
    onUpdate({ settings: { ...settings, ...patch } });
  };

  const updateTestimonials = (testimonials: TestimonialsSection['content']['testimonials']) => {
    onUpdate({ content: { testimonials } });
  };

  const addTestimonial = () => {
    updateTestimonials([
      ...content.testimonials,
      {
        id: uuid(),
        text: 'Share what customers love about your products.',
        author: 'Customer name',
        role: 'Verified buyer',
        rating: 5,
      },
    ]);
  };

  const removeTestimonial = (id: string) => {
    updateTestimonials(content.testimonials.filter((t) => t.id !== id));
  };

  const patchTestimonial = (index: number, patch: Partial<TestimonialsSection['content']['testimonials'][number]>) => {
    const next = [...content.testimonials];
    next[index] = { ...next[index], ...patch };
    updateTestimonials(next);
  };

  const moveTestimonial = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= content.testimonials.length) return;
    const next = [...content.testimonials];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateTestimonials(next);
  };

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Section title</label>
        <input
          type="text"
          className="panel-input"
          value={settings.title || ''}
          onChange={(e) => updateSettings({ title: e.target.value })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Layout</label>
        <SidebarDropdownField
          ariaLabel="Testimonials layout"
          value={settings.displayMode}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'carousel', label: 'Carousel (single row)' },
          ]}
          onChange={(next) => updateSettings({ displayMode: next as 'carousel' | 'grid' })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Columns (grid)</label>
        <SidebarDropdownField
          ariaLabel="Testimonials grid columns"
          value={String(settings.columns)}
          options={[
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
          ]}
          onChange={(next) => updateSettings({ columns: parseInt(next, 10) as 1 | 2 | 3 })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={settings.showRating}
            onChange={(e) => updateSettings({ showRating: e.target.checked })}
          />
          <span>Show star rating</span>
        </label>
      </div>

      <div className="panel-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className="panel-label" style={{ margin: 0 }}>
            Testimonials ({content.testimonials.length})
          </label>
          <button type="button" className="btn-text" onClick={addTestimonial}>
            + Add
          </button>
        </div>

        {content.testimonials.length === 0 ? (
          <p className="catalogue-picker-hint" style={{ margin: 0 }}>
            No testimonials yet. Add one to get started.
          </p>
        ) : (
          content.testimonials.map((item, index) => (
            <div key={item.id} className="faq-editor-item testimonial-editor-item">
              {settings.showRating && (
                <div className="testimonial-editor-stars">
                  <span className="testimonial-editor-stars-label">Star rating</span>
                  <TestimonialStarRating
                    rating={item.rating ?? 5}
                    size={20}
                    interactive
                    onChange={(rating) => patchTestimonial(index, { rating })}
                  />
                </div>
              )}
              <textarea
                className="panel-textarea"
                rows={3}
                placeholder="Quote"
                value={item.text}
                onChange={(e) => patchTestimonial(index, { text: e.target.value })}
              />
              <input
                type="text"
                className="panel-input"
                placeholder="Author name"
                value={item.author}
                onChange={(e) => patchTestimonial(index, { author: e.target.value })}
              />
              <input
                type="text"
                className="panel-input"
                placeholder="Role or label (e.g. Verified buyer)"
                value={item.role || ''}
                onChange={(e) => patchTestimonial(index, { role: e.target.value })}
              />
              <div className="testimonial-editor-actions">
                <button
                  type="button"
                  className="btn-icon-sm"
                  disabled={index === 0}
                  onClick={() => moveTestimonial(index, -1)}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-icon-sm"
                  disabled={index === content.testimonials.length - 1}
                  onClick={() => moveTestimonial(index, 1)}
                  title="Move down"
                >
                  ↓
                </button>
                <button type="button" className="btn-text danger" onClick={() => removeTestimonial(item.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}

        <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={addTestimonial}>
          + Add testimonial
        </button>
      </div>
    </>
  );
}
