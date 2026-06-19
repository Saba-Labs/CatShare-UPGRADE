import './catalog-announcement-bar.css';

interface CatalogAnnouncementBarProps {
  text: string;
  link?: string;
}

export default function CatalogAnnouncementBar({ text, link }: CatalogAnnouncementBarProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const href = link?.trim();
  const content = href ? (
    <a className="catalog-announcement-bar__link" href={href} target="_blank" rel="noreferrer">
      {trimmed}
    </a>
  ) : (
    trimmed
  );

  return (
    <div className="catalog-announcement-bar" role="region" aria-label="Store announcement">
      <div className="catalog-announcement-bar__inner">{content}</div>
    </div>
  );
}
