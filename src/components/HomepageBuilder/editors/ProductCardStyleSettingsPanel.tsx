import SidebarDropdownField from '../SidebarDropdownField';
import PanelFieldLabel from '../PanelFieldLabel';
import {
  normalizeProductCardStyle,
  getProductCardStyleMeta,
  patchesWhenProductCardStyleChanges,
  productCardStyleForcesGridLayout,
  productCardStyleShowsImageRatio,
  productCardStyleImageRatioOptions,
  PRODUCT_CARD_STYLE_OPTIONS,
  type ProductCardStyle,
  type ProductListViewMode,
  type LegacyProductSectionDisplayMode,
} from '../../../utils/productCardStyles';
import type { ProductImageRatio } from '../../../types/storeBehaviorSettings';

interface ProductCardStyleSettingsPanelProps {
  cardStyle: ProductCardStyle | string | undefined;
  onCardStyleChange: (style: ProductCardStyle, layoutPatch?: ReturnType<typeof patchesWhenProductCardStyleChanges>) => void;
  viewMode?: ProductListViewMode;
  onViewModeChange?: (mode: ProductListViewMode) => void;
  productImageRatio?: ProductImageRatio;
  onProductImageRatioChange?: (ratio: ProductImageRatio) => void;
  columns?: 2 | 3 | 4;
  onColumnsChange?: (columns: 2 | 3 | 4) => void;
  showViewMode?: boolean;
  showImageRatio?: boolean;
  showGridColumns?: boolean;
  cardStyleAriaLabel?: string;
  displayMode?: LegacyProductSectionDisplayMode;
}

export default function ProductCardStyleSettingsPanel({
  cardStyle,
  onCardStyleChange,
  viewMode,
  onViewModeChange,
  productImageRatio,
  onProductImageRatioChange,
  columns,
  onColumnsChange,
  showViewMode = false,
  showImageRatio = false,
  showGridColumns = false,
  cardStyleAriaLabel = 'Product card style',
  displayMode,
}: ProductCardStyleSettingsPanelProps) {
  const resolvedStyle = normalizeProductCardStyle(cardStyle);
  const meta = getProductCardStyleMeta(resolvedStyle);
  const gridOnly = productCardStyleForcesGridLayout(resolvedStyle);
  const effectiveViewMode = gridOnly ? 'grid' : viewMode ?? meta.defaultViewMode;

  return (
    <>
      <div className="panel-section">
        <PanelFieldLabel
          label="Card style"
          hint="Each style has its own layout rules. Grid-only styles switch view mode automatically."
        />
        <SidebarDropdownField
          ariaLabel={cardStyleAriaLabel}
          value={resolvedStyle}
          options={PRODUCT_CARD_STYLE_OPTIONS}
          onChange={(next) => {
            const style = next as ProductCardStyle;
            const layoutPatch = patchesWhenProductCardStyleChanges(style, {
              viewMode: effectiveViewMode,
              productImageRatio,
              columns,
              displayMode,
            });
            onCardStyleChange(style, layoutPatch);
          }}
        />
        <p className="sidebar-field-hint">{meta.summary}</p>
      </div>

      {showViewMode && onViewModeChange ? (
        <div className="panel-section">
          <PanelFieldLabel
            label="View mode"
            hint={
              gridOnly
                ? `${meta.label} only works as a grid. List view is unavailable.`
                : 'List shows one product per row with quantity controls. Grid shows a tile layout.'
            }
          />
          <SidebarDropdownField
            ariaLabel="Product list view mode"
            value={effectiveViewMode}
            disabled={gridOnly}
            options={[
              { value: 'list', label: 'List', disabled: gridOnly },
              { value: 'grid', label: 'Grid' },
            ]}
            onChange={(next) => onViewModeChange(next as ProductListViewMode)}
          />
        </div>
      ) : null}

      {showImageRatio && onProductImageRatioChange && productCardStyleShowsImageRatio(resolvedStyle) ? (
        <div className="panel-section">
          <PanelFieldLabel
            label="Product image ratio"
            hint={
              meta.imageRatioMode === 'portrait-only'
                ? 'This card style works best with portrait or square images.'
                : 'Crop ratio for product photos in each card.'
            }
          />
          <SidebarDropdownField
            ariaLabel="Product image ratio"
            value={productImageRatio ?? 'square'}
            options={productCardStyleImageRatioOptions(resolvedStyle)}
            onChange={(next) => onProductImageRatioChange(next as ProductImageRatio)}
          />
        </div>
      ) : null}

      {showGridColumns && onColumnsChange ? (
        meta.fixedGridColumns ? (
          <div className="panel-section">
            <PanelFieldLabel
              label="Grid columns"
              hint={`${meta.label} uses a fixed ${meta.fixedGridColumns}-column layout.`}
            />
            <SidebarDropdownField
              ariaLabel="Catalog grid columns"
              value={String(meta.fixedGridColumns)}
              disabled
              options={[{ value: String(meta.fixedGridColumns), label: `${meta.fixedGridColumns} columns` }]}
              onChange={() => {
                /* fixed column count for this style */
              }}
            />
          </div>
        ) : (
          <div className="panel-section">
            <label className="panel-label">Grid columns (desktop)</label>
            <SidebarDropdownField
              ariaLabel="Catalog grid columns"
              value={String(columns ?? 4)}
              options={[
                { value: '2', label: '2 columns' },
                { value: '3', label: '3 columns' },
                { value: '4', label: '4 columns' },
              ]}
              onChange={(next) => onColumnsChange(Number(next) as 2 | 3 | 4)}
            />
          </div>
        )
      ) : null}
    </>
  );
}
