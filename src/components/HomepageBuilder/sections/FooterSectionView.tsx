import React from 'react';
import { FooterSection } from '../../../types/homepage';
import './FooterSection.css';

interface FooterSectionViewProps {
  section: FooterSection & { id: string };
  editMode?: boolean;
}

export default function FooterSectionView({ section }: FooterSectionViewProps) {
  const { settings, content } = section;

  return (
    <footer
      className="footer-section-block sites-section-pad--footer"
      style={{
        background: settings.backgroundColor || '#1f2937',
        color: settings.textColor || '#f9fafb',
      }}
    >
      {settings.layout === 'multi-column' ? (
        <div className="footer-section-block__grid">
          <div>
            <h4 className="footer-section-block__heading">{content.company}</h4>
            <p className="footer-section-block__text">{content.description}</p>
          </div>
          <div>
            <h4 className="footer-section-block__heading">Quick Links</h4>
            <ul className="footer-section-block__links">
              {content.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} className="footer-section-block__link">
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="footer-section-block__heading">Follow Us</h4>
            <div className="footer-section-block__social">
              {content.social?.map((s) => (
                <a key={s.platform} href={s.url} className="footer-section-block__link">
                  {s.platform}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 className="footer-section-block--simple-title">{content.company}</h3>
          <p className="footer-section-block__text" style={{ marginBottom: '1.25rem' }}>
            {content.description}
          </p>
        </div>
      )}

      <div className="footer-section-block__copyright">{content.copyright}</div>
    </footer>
  );
}
