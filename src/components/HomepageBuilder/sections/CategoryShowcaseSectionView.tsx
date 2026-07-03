import React, { useMemo } from 'react';
import { CategoryShowcaseSection } from '../../../types/homepage';
import SectionPlaceholder from './SectionPlaceholder';
import StorefrontLink from '../../WebsiteBuilder/StorefrontLink';
import { useWebsiteStoreOptional } from '../../WebsiteBuilder/WebsiteStoreContext';
import { deriveStoreCategories } from '../../../utils/storefrontCategories';
import {
  getCategoryShowcaseClassName,
  getCategoryShowcaseInlineStyle,
  resolveCategoryShowcaseSettings,
} from '../../../utils/categoryShowcaseStyles';
import { IconFolder, IconTag } from '../../Storefront/StorefrontIcons';
import CategoryShowcaseScrollRow from './CategoryShowcaseScrollRow';
import './category-showcase.css';

interface CategoryShowcaseSectionViewProps {
  section: CategoryShowcaseSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
  onUpdateSection?: (updates: Partial<CategoryShowcaseSection>) => void;
  onCategoryPreview?: (category: { id: string; label: string }) => void;
}

type ResolvedCategory = {
  id: string;
  label: string;
  count: number;
  imageUrl?: string;
  showCount: boolean;
  href?: string;
};

function formatItemCount(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

function stopEditPointer(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation();
}

export default function CategoryShowcaseSectionView({
  section,
  editMode,
  builderCanvas = false,
  onUpdateSection,
  onCategoryPreview,
}: CategoryShowcaseSectionViewProps) {
  const { settings, content } = section;
  const resolved = resolveCategoryShowcaseSettings(settings);
  const storeCtx = useWebsiteStoreOptional();
  const categoryImages = content.categoryImages || {};
  const customCategories = content.customCategories || [];

  const resolvedCategories = useMemo((): ResolvedCategory[] => {
    const derived = storeCtx
      ? (() => {
          const all = deriveStoreCategories(storeCtx.products);
          const selected = new Set(content.categoryIds.map((id) => id.toLowerCase()));
          const picked =
            selected.size > 0
              ? all.filter((c) => selected.has(c.id))
              : customCategories.length === 0
                ? all.slice(0, 8)
                : [];
          return picked.map((c) => ({
            id: c.id,
            label: c.label,
            count: c.count,
            imageUrl: categoryImages[c.id] || c.imageUrl,
            showCount: true,
          }));
        })()
      : [];
    const custom = customCategories.map((c) => ({
      id: c.id,
      label: c.label,
      count: 0,
      imageUrl: c.imageUrl,
      showCount: false,
      href: c.link || undefined,
    }));
    return [
      ...derived.map((c) => ({
        ...c,
        href: `/collections/all?category=${encodeURIComponent(c.id)}`,
      })),
      ...custom,
    ];
  }, [storeCtx, content.categoryIds, categoryImages, customCategories]);

  const hasAnySelection = resolvedCategories.length > 0;
  const rootClass = getCategoryShowcaseClassName(resolved);
  const rootStyle = getCategoryShowcaseInlineStyle(resolved);
  const canEditHeading = editMode && !!onUpdateSection;

  return (
    <section className={rootClass} style={rootStyle}>
      {resolved.title ? (
        canEditHeading ? (
          <h2
            className="cat-showcase__heading sites-inline-editable"
            contentEditable
            suppressContentEditableWarning
            onPointerDown={stopEditPointer}
            onMouseDown={stopEditPointer}
            onClick={stopEditPointer}
            onBlur={(e) =>
              onUpdateSection({
                settings: { ...settings, title: e.currentTarget.textContent || '' },
              })
            }
          >
            {resolved.title}
          </h2>
        ) : (
          <h2 className="cat-showcase__heading">{resolved.title}</h2>
        )
      ) : null}
      {!hasAnySelection ? (
        <SectionPlaceholder
          title="Category Showcase"
          icon={<IconFolder size={48} />}
          description={
            editMode
              ? 'Select categories in the sidebar, or they will appear from your products'
              : 'No categories in your store yet'
          }
          editMode={editMode}
        />
      ) : resolved.layout === 'grid' || resolved.layout === 'list' ? (
        <div className="cat-showcase__track">
          {resolvedCategories.map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              settings={resolved}
              builderCanvas={builderCanvas}
              onCategoryPreview={onCategoryPreview}
            />
          ))}
        </div>
      ) : (
        <CategoryShowcaseScrollRow navigation={resolved.navigation}>
          {resolvedCategories.map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              settings={resolved}
              builderCanvas={builderCanvas}
              onCategoryPreview={onCategoryPreview}
            />
          ))}
        </CategoryShowcaseScrollRow>
      )}
    </section>
  );
}

function CategoryTile({
  category,
  settings,
  builderCanvas = false,
  onCategoryPreview,
}: {
  category: ResolvedCategory;
  settings: ReturnType<typeof resolveCategoryShowcaseSettings>;
  builderCanvas?: boolean;
  onCategoryPreview?: (category: { id: string; label: string }) => void;
}) {
  const showCount = settings.showCount && category.showCount && category.count > 0;
  const media = (
    <div className="cat-showcase__media">
      {category.imageUrl ? (
        <img src={category.imageUrl} alt="" loading="lazy" />
      ) : (
        <span className="cat-showcase__placeholder-wrap" aria-hidden>
          <IconTag size={28} className="cat-showcase__placeholder" />
        </span>
      )}
      {settings.labelStyle === 'overlay' ? (
        <div className="cat-showcase__body">
          <p className="cat-showcase__label">{category.label}</p>
          {showCount ? <p className="cat-showcase__count">{formatItemCount(category.count)}</p> : null}
        </div>
      ) : null}
    </div>
  );

  const body =
    settings.labelStyle === 'below' ? (
      <div className="cat-showcase__body">
        <p className="cat-showcase__label">{category.label}</p>
        {showCount ? <p className="cat-showcase__count">{formatItemCount(category.count)}</p> : null}
      </div>
    ) : null;

  const inner = (
    <>
      {media}
      {body}
    </>
  );

  if (builderCanvas && onCategoryPreview) {
    return (
      <button
        type="button"
        className="cat-showcase__card"
        aria-label={`Edit ${category.label} category page`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCategoryPreview({ id: category.id, label: category.label });
        }}
      >
        {inner}
      </button>
    );
  }

  if (category.href && !builderCanvas) {
    return (
      <StorefrontLink href={category.href} className="cat-showcase__card" aria-label={category.label}>
        {inner}
      </StorefrontLink>
    );
  }

  return <div className="cat-showcase__card">{inner}</div>;
}
