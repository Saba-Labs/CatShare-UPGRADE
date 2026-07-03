import { v4 as uuid } from 'uuid';
import type { HomepageLayout, HomepageSection } from '../types/homepage';

type BuilderSection = HomepageLayout['sections'][number];

let orderCounter = 0;

export function resetTemplateSectionOrder() {
  orderCounter = 0;
}

export function templateSection(
  part: HomepageSection,
  blockLayout?: BuilderSection['blockLayout']
): BuilderSection {
  return {
    ...(part as HomepageSection),
    id: uuid(),
    order: orderCounter++,
    ...(blockLayout ? { blockLayout } : {}),
  } as BuilderSection;
}

export function templateImg(templateId: string, name: string): string {
  return `/templates/${templateId}/${name}`;
}

export function navHomeShop() {
  return [
    { id: uuid(), label: 'Home', href: '/' },
    { id: uuid(), label: 'Shop', href: '/collections/all' },
  ];
}
