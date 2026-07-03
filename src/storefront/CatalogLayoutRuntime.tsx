import type { HomepageLayout } from '../types/homepage';
import SectionRenderer from '../components/HomepageBuilder/sections/SectionRenderer';
import { getBlockInnerStyleForLive, getBlockRowStyle } from '../utils/blockLayout';

interface CatalogLayoutRuntimeProps {
  layout: HomepageLayout;
  storeId?: string;
}

/**
 * Renders published homepage sections for classic catalog / default-store mode.
 * Uses the same section renderer as website home pages.
 */
export default function CatalogLayoutRuntime({ layout, storeId }: CatalogLayoutRuntimeProps) {
  const sections = [...(layout.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <main
      className="catalog-layout-runtime"
      style={{
        background: layout.theme?.backgroundColor || '#f7f7f5',
        color: layout.theme?.textColor || '#1a1a1a',
        fontFamily: layout.theme?.fontFamily,
      }}
    >
      {sections.map((section) => (
        <div key={section.id} style={getBlockRowStyle(section.blockLayout)}>
          <div style={getBlockInnerStyleForLive(section.blockLayout, section.type)}>
            <SectionRenderer section={section as HomepageLayout['sections'][number] & { id: string }} theme={layout.theme} storeId={storeId} />
          </div>
        </div>
      ))}
    </main>
  );
}
