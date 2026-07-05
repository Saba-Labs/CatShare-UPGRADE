import React, { useState } from 'react';
import { FaqSection } from '../../../types/homepage';
import BuilderInlineEditable from '../BuilderInlineEditable';
import BuilderHtmlContent from '../BuilderHtmlContent';
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
            <BuilderInlineEditable
              tag="span"
              value={settings.title}
              onChange={(title) => onUpdateSection({ settings: { ...settings, title } })}
            />
          ) : (
            <BuilderHtmlContent html={settings.title} tag="span" />
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
                  <BuilderInlineEditable
                    tag="span"
                    value={item.question}
                    onChange={(question) => updateItem(item.id, { question })}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <BuilderHtmlContent html={item.question} tag="span" />
                )}
                <span className="faq-chevron" aria-hidden>
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {(isOpen || editMode) && (
                <div className="faq-answer">
                  {editMode && onUpdateSection ? (
                    <BuilderInlineEditable
                      tag="p"
                      value={item.answer}
                      onChange={(answer) => updateItem(item.id, { answer })}
                    />
                  ) : (
                    <p>
                      <BuilderHtmlContent html={item.answer} tag="span" />
                    </p>
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
