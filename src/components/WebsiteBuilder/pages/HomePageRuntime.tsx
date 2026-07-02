import SectionRenderer from '../../HomepageBuilder/sections/SectionRenderer';
import type { HomepageLayout } from '../../../types/homepage';
import { getBlockInnerStyleForLive, getBlockRowStyle } from '../../../utils/blockLayout';

interface HomePageRuntimeProps {
  layout: HomepageLayout;
}

export default function HomePageRuntime({ layout }: HomePageRuntimeProps) {
  const sections = layout.sections || [];
  return (
    <main style={{ background: layout.theme?.backgroundColor || '#ffffff', color: layout.theme?.textColor || '#111827' }}>
      {sections.map((section) => (
        <div key={section.id} style={getBlockRowStyle(section.blockLayout)}>
          <div style={getBlockInnerStyleForLive(section.blockLayout)}>
            <SectionRenderer section={section} theme={layout.theme} editMode={false} />
          </div>
        </div>
      ))}
    </main>
  );
}
