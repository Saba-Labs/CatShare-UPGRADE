import React from 'react';
import { FooterSection } from '../../../types/homepage';

interface FooterSectionViewProps {
  section: FooterSection & { id: string };
  editMode?: boolean;
}

export default function FooterSectionView({ section }: FooterSectionViewProps) {
  const { settings, content } = section;

  return (
    <footer
      style={{
        background: settings.backgroundColor || '#1f2937',
        color: settings.textColor || '#f9fafb',
        padding: '40px 20px',
        borderRadius: '8px',
      }}
    >
      {settings.layout === 'multi-column' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', marginBottom: '30px' }}>
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontWeight: 600 }}>{content.company}</h4>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.8 }}>{content.description}</p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontWeight: 600 }}>Quick Links</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {content.links.map((link) => (
                <li key={link.url} style={{ marginBottom: '8px' }}>
                  <a href={link.url} style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.875rem' }}>
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontWeight: 600 }}>Follow Us</h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              {content.social?.map((s) => (
                <a key={s.platform} href={s.url} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {s.platform}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontWeight: 600 }}>{content.company}</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.875rem', opacity: 0.8 }}>{content.description}</p>
        </div>
      )}

      <div style={{ borderTop: `1px solid rgba(255,255,255,0.1)`, paddingTop: '20px', textAlign: 'center', fontSize: '0.875rem', opacity: 0.8 }}>
        {content.copyright}
      </div>
    </footer>
  );
}
