import type { ElementType } from 'react';
import { containsBuilderHtml, sanitizeBuilderHtml } from '../../utils/builderRichText';

interface BuilderHtmlContentProps {
  html?: string;
  className?: string;
  tag?: ElementType;
}

export default function BuilderHtmlContent({
  html = '',
  className,
  tag: Tag = 'div',
}: BuilderHtmlContentProps) {
  if (containsBuilderHtml(html)) {
    return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizeBuilderHtml(html) }} />;
  }
  return <Tag className={className}>{html}</Tag>;
}
