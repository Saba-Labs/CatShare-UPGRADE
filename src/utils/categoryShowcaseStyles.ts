import type { CategoryShowcaseSection } from '../types/homepage';

export type CategoryShowcaseLayout = CategoryShowcaseSection['settings']['layout'];
export type CategoryCardStyle = NonNullable<CategoryShowcaseSection['settings']['cardStyle']>;
export type CategoryCardShape = NonNullable<CategoryShowcaseSection['settings']['cardShape']>;
export type CategoryCardSize = NonNullable<CategoryShowcaseSection['settings']['cardSize']>;
export type CategoryImageRatio = NonNullable<CategoryShowcaseSection['settings']['imageRatio']>;
export type CategoryImageFit = NonNullable<CategoryShowcaseSection['settings']['imageFit']>;
export type CategoryGap = NonNullable<CategoryShowcaseSection['settings']['gap']>;
export type CategoryLabelStyle = NonNullable<CategoryShowcaseSection['settings']['labelStyle']>;
export type CategoryHoverEffect = NonNullable<CategoryShowcaseSection['settings']['hoverEffect']>;
export type CategoryTitleAlign = NonNullable<CategoryShowcaseSection['settings']['titleAlign']>;

export type ResolvedCategoryShowcaseSettings = Required<
  Pick<
    CategoryShowcaseSection['settings'],
    | 'title'
    | 'columns'
    | 'layout'
    | 'showCount'
    | 'cardStyle'
    | 'cardShape'
    | 'cardSize'
    | 'imageRatio'
    | 'imageFit'
    | 'gap'
    | 'titleAlign'
    | 'labelStyle'
    | 'hoverEffect'
  >
> &
  Pick<CategoryShowcaseSection['settings'], 'backgroundColor' | 'cardBackground' | 'labelColor'>;

const IMAGE_HEIGHT: Record<CategoryCardSize, string> = {
  sm: '96px',
  md: '140px',
  lg: '200px',
  xl: '280px',
};

const ASPECT_RATIO: Record<CategoryImageRatio, string> = {
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '3:4': '3 / 4',
  '16:9': '16 / 9',
  '2:3': '2 / 3',
};

export function resolveCategoryShowcaseSettings(
  settings: CategoryShowcaseSection['settings']
): ResolvedCategoryShowcaseSettings {
  return {
    title: settings.title ?? 'Shop by Category',
    columns: settings.columns ?? 3,
    layout: settings.layout ?? 'grid',
    showCount: settings.showCount ?? true,
    backgroundColor: settings.backgroundColor,
    cardStyle: settings.cardStyle ?? 'card',
    cardShape: settings.cardShape ?? 'rounded',
    cardSize: settings.cardSize ?? 'md',
    imageRatio: settings.imageRatio ?? '4:3',
    imageFit: settings.imageFit ?? 'cover',
    gap: settings.gap ?? 'md',
    titleAlign: settings.titleAlign ?? 'left',
    labelStyle: settings.labelStyle ?? 'below',
    hoverEffect: settings.hoverEffect ?? 'lift',
    cardBackground: settings.cardBackground,
    labelColor: settings.labelColor,
  };
}

export function getCategoryShowcaseClassName(settings: ResolvedCategoryShowcaseSettings): string {
  const parts = [
    'cat-showcase',
    `cat-showcase--layout-${settings.layout}`,
    `cat-showcase--style-${settings.cardStyle}`,
    `cat-showcase--shape-${settings.cardShape}`,
    `cat-showcase--size-${settings.cardSize}`,
    `cat-showcase--gap-${settings.gap}`,
    `cat-showcase--label-${settings.labelStyle}`,
    `cat-showcase--hover-${settings.hoverEffect}`,
    `cat-showcase--title-${settings.titleAlign}`,
  ];
  if (settings.labelStyle === 'overlay') {
    parts.push('cat-showcase--overlay-labels');
  }
  if (settings.imageFit === 'contain') {
    parts.push('cat-showcase--fit-contain');
  }
  return parts.join(' ');
}

export function getCategoryShowcaseInlineStyle(
  settings: ResolvedCategoryShowcaseSettings
): Record<string, string | undefined> {
  const isCircle = settings.cardShape === 'circle';
  const useAspect = !isCircle || settings.layout === 'list';

  return {
    '--cat-cols': String(settings.columns),
    '--cat-image-height': isCircle && settings.layout !== 'list' ? 'auto' : IMAGE_HEIGHT[settings.cardSize],
    '--cat-aspect': useAspect ? ASPECT_RATIO[settings.imageRatio] : '1 / 1',
    '--cat-card-bg': settings.cardBackground || '#ffffff',
    '--cat-label-color': settings.labelColor || 'inherit',
    background: settings.backgroundColor || 'transparent',
  };
}
