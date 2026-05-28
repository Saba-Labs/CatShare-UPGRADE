import React from 'react';
import { FaqSection } from '../../../types/homepage';
import { v4 as uuid } from 'uuid';

interface FaqSectionEditorProps {
  section: FaqSection & { id: string };
  onUpdate: (updates: Partial<FaqSection>) => void;
}

export default function FaqSectionEditor({ section, onUpdate }: FaqSectionEditorProps) {
  const { content } = section;

  const addItem = () => {
    onUpdate({
      content: {
        items: [
          ...content.items,
          { id: uuid(), question: 'New question', answer: 'Answer goes here.' },
        ],
      },
    });
  };

  const removeItem = (id: string) => {
    onUpdate({ content: { items: content.items.filter((i) => i.id !== id) } });
  };

  return (
    <>
      <div className="panel-section">
        <label className="panel-label">Section title</label>
        <input
          type="text"
          className="panel-input"
          value={section.settings.title || ''}
          onChange={(e) => onUpdate({ settings: { ...section.settings, title: e.target.value } })}
        />
      </div>

      <div className="panel-section">
        <label className="panel-label">Questions ({content.items.length})</label>
        {content.items.map((item, index) => (
          <div key={item.id} className="faq-editor-item">
            <input
              type="text"
              className="panel-input"
              placeholder="Question"
              value={item.question}
              onChange={(e) => {
                const items = [...content.items];
                items[index] = { ...item, question: e.target.value };
                onUpdate({ content: { items } });
              }}
            />
            <textarea
              className="panel-textarea"
              rows={2}
              placeholder="Answer"
              value={item.answer}
              onChange={(e) => {
                const items = [...content.items];
                items[index] = { ...item, answer: e.target.value };
                onUpdate({ content: { items } });
              }}
            />
            <button type="button" className="btn-text danger" onClick={() => removeItem(item.id)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={addItem}>
          + Add question
        </button>
      </div>
    </>
  );
}
