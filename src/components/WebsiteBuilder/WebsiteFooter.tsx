import type { WebsiteSiteSettings } from '../../types/homepage';

interface WebsiteFooterProps {
  siteSettings: WebsiteSiteSettings;
}

export default function WebsiteFooter({ siteSettings }: WebsiteFooterProps) {
  const columns = siteSettings.footerColumns || [];
  return (
    <footer style={{ background: siteSettings.footerBg || '#0f172a', color: siteSettings.footerTextColor || '#e2e8f0', marginTop: 30 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{siteSettings.websiteName || 'My Store'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
          {columns.map((column, index) => (
            <div key={`${column.title}-${index}`}>
              <div style={{ fontSize: 12, opacity: 0.9, textTransform: 'uppercase', marginBottom: 8 }}>{column.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {column.links.map((link) => (
                  <a key={link.id} href={link.href} style={{ color: 'inherit', opacity: 0.9, textDecoration: 'none' }}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
