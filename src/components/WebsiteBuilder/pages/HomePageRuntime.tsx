import SectionRenderer from '../../HomepageBuilder/sections/SectionRenderer';
import type { HomepageLayout } from '../../../types/homepage';

interface HomePageRuntimeProps {
  layout: HomepageLayout;
}

export default function HomePageRuntime({ layout }: HomePageRuntimeProps) {
  const sections = layout.sections || [];
  return (
    <main style={{ background: layout.theme?.backgroundColor || '#ffffff', color: layout.theme?.textColor || '#111827' }}>
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} editMode={false} />
      ))}
    </main>
  );
}
