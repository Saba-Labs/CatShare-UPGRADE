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
import CategoryShowcaseMobileRow from './CategoryShowcaseMobileRow';
import './category-showcase.css';

interface CategoryShowcaseSectionViewProps {
  section: CategoryShowcaseSection & { id: string };
  editMode?: boolean;
  builderCanvas?: boolean;
}

type ResolvedCategory = {
  id: string;
  label: string;
  count: number;
  imageUrl?: string;
  showCount: boolean;
  href?: string;
};

export default function CategoryShowcaseSectionView({ section, editMode, builderCanvas = false }: CategoryShowcaseSectionViewProps) {
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
                ? all.slice(0, Math.max(resolved.columns * 2, 4))
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
  }, [storeCtx, content.categoryIds, categoryImages, customCategories, resolved.columns]);

  const hasAnySelection = resolvedCategories.length > 0;
  const rootClass = getCategoryShowcaseClassName(resolved);
  const rootStyle = getCategoryShowcaseInlineStyle(resolved);

  return (
    <section className={rootClass} style={rootStyle}>
      {resolved.title ? <h2 className="cat-showcase__heading">{resolved.title}</h2> : null}
      {!hasAnySelection ? (
        <SectionPlaceholder
          title="Category Showcase"
          icon={<IconFolder size={48} />}
          description={
            editMode
              ? 'Add categories in the sidebar, or they will appear from your product list'
              : 'No categories in your store yet'
          }
          editMode={editMode}
        />
      ) : resolved.layout === 'grid' ? (
        <CategoryShowcaseMobileRow>
          {resolvedCategories.map((category) => (
            <CategoryTile key={category.id} category={category} settings={resolved} builderCanvas={builderCanvas} />
          ))}
        </CategoryShowcaseMobileRow>
      ) : (
        <div className="cat-showcase__track">
          {resolvedCategories.map((category) => (
            <CategoryTile key={category.id} category={category} settings={resolved} builderCanvas={builderCanvas} />
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryTile({
  category,
  settings,
  builderCanvas = false,
}: {
  category: ResolvedCategory;
  settings: ReturnType<typeof resolveCategoryShowcaseSettings>;
  builderCanvas?: boolean;
}) {
  const showCount = settings.showCount && category.showCount && category.count > 0;
  const media = (
    <div className="cat-showcase__media">
      {category.imageUrl ? (
        <img src={category.imageUrl} alt={category.label} loading="lazy" />
      ) : (
        <IconTag size={40} className="cat-showcase__placeholder" />
      )}
      {settings.labelStyle === 'overlay' ? (
        <div className="cat-showcase__body">
          <p className="cat-showcase__label">{category.label}</p>
          {showCount ? <p className="cat-showcase__count">{category.count} items</p> : null}
        </div>
      ) : null}
    </div>
  );

  const body =
    settings.labelStyle === 'below' ? (
      <div className="cat-showcase__body">
        <p className="cat-showcase__label">{category.label}</p>
        {showCount ? <p className="cat-showcase__count">{category.count} items</p> : null}
      </div>
    ) : null;

  const inner = (
    <>
      {media}
      {body}
    </>
  );

  if (category.href && !builderCanvas) {
    return (
      <StorefrontLink href={category.href} className="cat-showcase__card">
        {inner}
      </StorefrontLink>
    );
  }

  return <div className="cat-showcase__card">{inner}</div>;
}
