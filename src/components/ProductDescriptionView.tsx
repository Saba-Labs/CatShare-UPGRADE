import { getProductDescriptionHtml } from '../utils/productDescriptionHtml';

export interface ProductDescriptionViewProps {
  html?: string;
  className?: string;
}

export default function ProductDescriptionView({ html, className = '' }: ProductDescriptionViewProps) {
  const safe = getProductDescriptionHtml(html);
  if (!safe) return null;

  return (
    <div
      className={`sv-product-description sv-product-description--rich ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
