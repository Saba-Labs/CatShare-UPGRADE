import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isExternalHref, resolveStorefrontHref } from '../../utils/storefrontHref';
import { useWebsiteStoreOptional } from './WebsiteStoreContext';

interface StorefrontLinkProps {
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export default function StorefrontLink({
  href = '#',
  className,
  style,
  children,
  onClick,
}: StorefrontLinkProps) {
  const store = useWebsiteStoreOptional();
  const resolved = resolveStorefrontHref(href, store?.basePath ?? '');

  if (isExternalHref(href)) {
    return (
      <a
        href={resolved}
        className={className}
        style={style}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <Link to={resolved} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}
