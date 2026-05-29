import SectionRenderer from '../../HomepageBuilder/sections/SectionRenderer';
import type { HomepageLayout } from '../../../types/homepage';
import { getBlockInnerStyle, getBlockRowStyle } from '../../../utils/blockLayout';

interface HomePageRuntimeProps {
  layout: HomepageLayout;
}

export default function HomePageRuntime({ layout }: HomePageRuntimeProps) {
  const sections = layout.sections || [];
  return (
    <main style={{ background: layout.theme?.backgroundColor || '#ffffff', color: layout.theme?.textColor || '#111827' }}>
      {sections.map((section) => (
        <div key={section.id} style={getBlockRowStyle(section.blockLayout)}>
          <div style={getBlockInnerStyle(section.blockLayout)}>
            <SectionRenderer section={section} editMode={false} />
          </div>
        </div>
      ))}
    </main>
  );
}
