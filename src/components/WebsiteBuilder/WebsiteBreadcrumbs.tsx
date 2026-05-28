import { Link } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

interface WebsiteBreadcrumbsProps {
  items: Crumb[];
}

export default function WebsiteBreadcrumbs({ items }: WebsiteBreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav className="website-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.to && index < items.length - 1 ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
