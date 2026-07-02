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
  /** Editor / preview: render without navigation (live site only). */
  preview?: boolean;
}

export default function StorefrontLink({
  href = '#',
  className,
  style,
  children,
  onClick,
  preview = false,
}: StorefrontLinkProps) {
  const store = useWebsiteStoreOptional();
  const resolved = resolveStorefrontHref(href, store?.basePath ?? '');

  if (preview) {
    return (
      <span
        className={className}
        style={style}
        role="link"
        aria-disabled="true"
        onClick={(e) => {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent<HTMLAnchorElement>);
        }}
      >
        {children}
      </span>
    );
  }

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
