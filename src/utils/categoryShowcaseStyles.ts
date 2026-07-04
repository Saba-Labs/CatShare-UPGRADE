import type { CategoryShowcaseSection } from '../types/homepage';

export type CategoryShowcaseLayout = CategoryShowcaseSection['settings']['layout'];
export type CategoryCardStyle = NonNullable<CategoryShowcaseSection['settings']['cardStyle']>;
export type CategoryCardShape = NonNullable<CategoryShowcaseSection['settings']['cardShape']>;
export type CategoryCardSize = NonNullable<CategoryShowcaseSection['settings']['cardSize']>;
export type CategoryImageRatio = NonNullable<CategoryShowcaseSection['settings']['imageRatio']>;
export type CategoryImageFit = NonNullable<CategoryShowcaseSection['settings']['imageFit']>;
export type CategoryGap = NonNullable<CategoryShowcaseSection['settings']['gap']>;
export type CategoryLabelStyle = NonNullable<CategoryShowcaseSection['settings']['labelStyle']>;
export type CategoryLabelAlign = NonNullable<CategoryShowcaseSection['settings']['labelAlign']>;
export type CategoryHoverEffect = NonNullable<CategoryShowcaseSection['settings']['hoverEffect']>;
export type CategoryTitleAlign = NonNullable<CategoryShowcaseSection['settings']['titleAlign']>;
export type CategoryScrollNavigation = NonNullable<CategoryShowcaseSection['settings']['navigation']>;
export type CategoryTilesAlign = NonNullable<CategoryShowcaseSection['settings']['tilesAlign']>;

export type ResolvedCategoryShowcaseSettings = Required<
  Pick<
    CategoryShowcaseSection['settings'],
    | 'title'
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
    | 'labelAlign'
    | 'hoverEffect'
    | 'navigation'
    | 'tilesAlign'
  >
> &
  Pick<CategoryShowcaseSection['settings'], 'backgroundColor' | 'cardBackground' | 'labelColor'>;

const IMAGE_HEIGHT: Record<CategoryCardSize, string> = {
  xs: '72px',
  sm: '88px',
  md: '120px',
  lg: '160px',
  xl: '200px',
};

const GRID_COL_MIN: Record<CategoryCardSize, string> = {
  xs: '6rem',
  sm: '7.5rem',
  md: '9.5rem',
  lg: '11.5rem',
  xl: '13rem',
};

const SCROLL_TILE_WIDTH: Record<CategoryCardSize, string> = {
  xs: '6rem',
  sm: '7.5rem',
  md: '9.5rem',
  lg: '11.5rem',
  xl: '13rem',
};

const ASPECT_RATIO: Record<CategoryImageRatio, string> = {
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '3:4': '3 / 4',
  '16:9': '16 / 9',
  '2:3': '2 / 3',
};

function normalizeLayout(layout: CategoryShowcaseSection['settings']['layout'] | undefined): CategoryShowcaseLayout {
  if (layout === 'carousel' || layout === 'list') return layout;
  return 'grid';
}

function normalizeCardStyle(style: CategoryShowcaseSection['settings']['cardStyle'] | undefined): 'minimal' | 'card' {
  if (style === 'minimal' || style === 'bordered' || style === 'overlay') return 'minimal';
  return 'card';
}

function normalizeCardShape(shape: CategoryShowcaseSection['settings']['cardShape'] | undefined): 'rounded' | 'circle' {
  if (shape === 'circle') return 'circle';
  return 'rounded';
}

function normalizeCardSize(size: CategoryShowcaseSection['settings']['cardSize'] | undefined): CategoryCardSize {
  if (size === 'xs' || size === 'sm' || size === 'md' || size === 'lg' || size === 'xl') return size;
  return 'md';
}

function normalizeTilesAlign(
  align: CategoryShowcaseSection['settings']['tilesAlign'] | undefined
): CategoryTilesAlign {
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

function normalizeImageRatio(
  ratio: CategoryShowcaseSection['settings']['imageRatio'] | undefined
): '1:1' | '4:3' | '3:4' {
  if (ratio === '4:3' || ratio === '16:9') return '4:3';
  if (ratio === '3:4' || ratio === '2:3') return '3:4';
  return '1:1';
}

function normalizeLabelAlign(
  align: CategoryShowcaseSection['settings']['labelAlign'] | undefined
): CategoryLabelAlign {
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

function normalizeNavigation(
  navigation: CategoryShowcaseSection['settings']['navigation'] | undefined
): CategoryScrollNavigation {
  if (navigation === 'dots' || navigation === 'arrows' || navigation === 'none') return navigation;
  return 'both';
}

export function resolveCategoryShowcaseSettings(
  settings: CategoryShowcaseSection['settings']
): ResolvedCategoryShowcaseSettings {
  const cardShape = normalizeCardShape(settings.cardShape);
  const layout = normalizeLayout(settings.layout);

  return {
    title: settings.title ?? 'Shop by Category',
    layout,
    showCount: settings.showCount ?? true,
    backgroundColor: settings.backgroundColor,
    cardStyle: normalizeCardStyle(settings.cardStyle),
    cardShape,
    cardSize: normalizeCardSize(settings.cardSize),
    imageRatio:
      cardShape === 'circle' && layout !== 'list'
        ? '1:1'
        : (normalizeImageRatio(settings.imageRatio) as CategoryImageRatio),
    imageFit: settings.imageFit ?? 'cover',
    gap: settings.gap ?? 'md',
    titleAlign: settings.titleAlign ?? 'left',
    labelStyle: settings.labelStyle ?? 'below',
    labelAlign: normalizeLabelAlign(settings.labelAlign),
    hoverEffect: settings.hoverEffect === 'none' ? 'none' : 'lift',
    navigation: layout === 'carousel' ? normalizeNavigation(settings.navigation) : 'none',
    tilesAlign: normalizeTilesAlign(settings.tilesAlign),
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
    `cat-showcase--label-align-${settings.labelAlign}`,
    `cat-showcase--hover-${settings.hoverEffect}`,
    `cat-showcase--title-${settings.titleAlign}`,
    `cat-showcase--tiles-${settings.tilesAlign}`,
  ];
  if (settings.labelStyle === 'overlay') {
    parts.push('cat-showcase--overlay-labels');
  }
  if (settings.imageFit === 'contain') {
    parts.push('cat-showcase--fit-contain');
  }
  if (settings.layout === 'carousel') {
    parts.push(`cat-showcase--nav-${settings.navigation}`);
  }
  return parts.join(' ');
}

export function getCategoryShowcaseInlineStyle(
  settings: ResolvedCategoryShowcaseSettings
): Record<string, string | undefined> {
  const isCircle = settings.cardShape === 'circle';
  const useAspect = !isCircle || settings.layout === 'list';

  return {
    '--cat-col-min': GRID_COL_MIN[settings.cardSize],
    '--cat-tile-width': SCROLL_TILE_WIDTH[settings.cardSize],
    '--cat-image-height': isCircle && settings.layout !== 'list' ? 'auto' : IMAGE_HEIGHT[settings.cardSize],
    '--cat-aspect': useAspect ? ASPECT_RATIO[settings.imageRatio] : '1 / 1',
    '--cat-card-bg': settings.cardBackground || (settings.cardStyle === 'card' ? '#ffffff' : 'transparent'),
    '--cat-label-color': settings.labelColor || 'inherit',
    background: settings.backgroundColor || 'transparent',
  };
}
