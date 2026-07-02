import React, { useState } from 'react';
import { FaqSection } from '../../../types/homepage';
import './FaqSection.css';

interface FaqSectionViewProps {
  section: FaqSection & { id: string };
  editMode?: boolean;
  onUpdateSection?: (updates: Partial<FaqSection>) => void;
}

export default function FaqSectionView({ section, editMode, onUpdateSection }: FaqSectionViewProps) {
  const { settings, content } = section;
  const [openId, setOpenId] = useState<string | null>(content.items[0]?.id || null);

  const updateItem = (id: string, patch: Partial<(typeof content.items)[0]>) => {
    onUpdateSection?.({
      content: {
        items: content.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      },
    });
  };

  return (
    <section
      className={`faq-section sites-section-pad--${settings.padding}`}
      style={{
        backgroundColor: settings.backgroundColor || '#fff',
      }}
    >
      {settings.title && (
        <h2 className="faq-section-title">
          {editMode && onUpdateSection ? (
            <span
              className="sites-inline-editable"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                onUpdateSection({ settings: { ...settings, title: e.currentTarget.textContent || '' } })
              }
            >
              {settings.title}
            </span>
          ) : (
            settings.title
          )}
        </h2>
      )}

      <div className="faq-list">
        {content.items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className={`faq-item ${isOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="faq-question"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
              >
                {editMode && onUpdateSection ? (
                  <span
                    className="sites-inline-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => updateItem(item.id, { question: e.currentTarget.textContent || '' })}
                  >
                    {item.question}
                  </span>
                ) : (
                  item.question
                )}
                <span className="faq-chevron" aria-hidden>
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {(isOpen || editMode) && (
                <div className="faq-answer">
                  {editMode && onUpdateSection ? (
                    <p
                      className="sites-inline-editable"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => updateItem(item.id, { answer: e.currentTarget.textContent || '' })}
                    >
                      {item.answer}
                    </p>
                  ) : (
                    <p>{item.answer}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
