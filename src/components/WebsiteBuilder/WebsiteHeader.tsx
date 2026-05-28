import { Link } from 'react-router-dom';
import type { WebsiteSiteSettings } from '../../types/homepage';

interface WebsiteHeaderProps {
  slug: string;
  siteSettings: WebsiteSiteSettings;
  onSubdomain?: boolean;
}

export default function WebsiteHeader({ slug, siteSettings, onSubdomain }: WebsiteHeaderProps) {
  const base = onSubdomain ? '' : `/store/${slug}`;
  const basePath = base || '/';
  const navItems = siteSettings.navItems || [];
  return (
    <header style={{ background: siteSettings.headerBg || '#fff', color: siteSettings.headerTextColor || '#111827', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      {siteSettings.showAnnouncement && siteSettings.announcementText ? (
        <div style={{ background: siteSettings.announcementBg || '#111827', color: siteSettings.announcementTextColor || '#fff', padding: '8px 14px', fontSize: 12, textAlign: 'center' }}>
          {siteSettings.announcementText}
        </div>
      ) : null}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link to={basePath} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}>
          {siteSettings.logoUrl ? (
            <img src={siteSettings.logoUrl} alt="" style={{ height: 28, verticalAlign: 'middle', marginRight: 8 }} />
          ) : null}
          {siteSettings.websiteName || 'My Store'}
        </Link>
        <nav style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.href.startsWith('/') ? `${basePath}${item.href === '/' ? '' : item.href}`.replace('//', '/') : item.href}
              style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
