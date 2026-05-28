import React, { useRef, useState } from 'react';
import { HomepageLayout, GridPosition, HomepageSection, ThemeSettings } from '../../types/homepage';
import SectionRenderer from './sections/SectionRenderer';
import { SECTION_TYPE_LABELS } from '../../config/homepageBuilderConfig';
import { useBuilderMedia } from './media/BuilderMediaContext';
import { applyMediaUrlToSection, sectionSupportsQuickMedia } from '../../utils/sectionMedia';
import './GridCanvas.css';

const GRID_COLUMNS = 12;
const GRID_GAP = 16;
const COLUMN_WIDTH = 60;
const SNAP_THRESHOLD = 5;

interface GridCanvasProps {
  layout: HomepageLayout;
  theme: ThemeSettings;
  storeId: string;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onUpdateSectionPosition: (id: string, position: GridPosition) => void;
  onUpdateSection: (id: string, updates: Partial<HomepageSection>) => void;
}

export default function GridCanvas({
  layout,
  theme,
  storeId,
  selectedSectionId,
  onSelectSection,
  onRemoveSection,
  onDuplicateSection,
  onUpdateSectionPosition,
  onUpdateSection,
}: GridCanvasProps) {
  const { openMediaPicker } = useBuilderMedia();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const getDefaultPosition = (index: number): GridPosition => ({
    column: 1,
    row: index + 1,
    width: GRID_COLUMNS,
    height: 1,
  });

  const getPositionStyle = (section: HomepageLayout['sections'][number]) => {
    const pos = section.gridPosition || getDefaultPosition(layout.sections.indexOf(section));
    const width = pos.width * COLUMN_WIDTH + (pos.width - 1) * (GRID_GAP / GRID_COLUMNS);
    const height = pos.height * 200 + (pos.height - 1) * GRID_GAP;
    return {
      gridColumn: `${pos.column} / span ${pos.width}`,
      gridRow: `${pos.row} / span ${pos.height}`,
      minHeight: `${height}px`,
    };
  };

  const handleSectionClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelectSection(id);
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const section = layout.sections.find((s) => s.id === id);
    if (!section) return;
    const pos = section.gridPosition || getDefaultPosition(layout.sections.indexOf(section));
    setResizingId(id);
    setResizeStart({ x: e.clientX, y: e.clientY, width: pos.width, height: pos.height });
  };

  React.useEffect(() => {
    if (!resizingId || !resizeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const columnPixelWidth = COLUMN_WIDTH + GRID_GAP / GRID_COLUMNS;
      const rowPixelHeight = 220;
      const rawDeltaX = (e.clientX - resizeStart.x) / columnPixelWidth;
      const rawDeltaY = (e.clientY - resizeStart.y) / rowPixelHeight;
      const deltaX = Math.abs(rawDeltaX) < SNAP_THRESHOLD / columnPixelWidth ? 0 : Math.round(rawDeltaX);
      const deltaY = Math.abs(rawDeltaY) < SNAP_THRESHOLD / rowPixelHeight ? 0 : Math.round(rawDeltaY);
      const newWidth = Math.max(1, Math.min(GRID_COLUMNS, resizeStart.width + deltaX));
      const newHeight = Math.max(1, resizeStart.height + deltaY);
      const section = layout.sections.find((s) => s.id === resizingId);
      if (section) {
        const pos = section.gridPosition || getDefaultPosition(layout.sections.indexOf(section));
        onUpdateSectionPosition(resizingId, { ...pos, width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setResizingId(null);
      setResizeStart(null);
      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'auto';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'auto';
    };
  }, [resizingId, resizeStart, layout, onUpdateSectionPosition]);

  return (
    <div
      className="grid-canvas-container sites-canvas"
      ref={canvasRef}
      onClick={() => onSelectSection(null)}
      style={{
        fontFamily: theme.fontFamily || undefined,
        color: theme.textColor || undefined,
        backgroundColor: theme.backgroundColor || '#fff',
        ['--site-primary' as string]: theme.primaryColor || '#1a73e8',
      }}
    >
      {layout.sections.length === 0 ? (
        <div className="canvas-empty sites-canvas-empty">
          <p>Click a block in Insert to start your page</p>
        </div>
      ) : (
        <div
          className="grid-container"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
            gap: `${GRID_GAP}px`,
          }}
        >
          {layout.sections.map((section) => {
            const isSelected = selectedSectionId === section.id;
            return (
              <div
                key={section.id}
                className={`grid-section sites-block ${isSelected ? 'selected' : ''} ${resizingId === section.id ? 'resizing' : ''}`}
                style={getPositionStyle(section)}
                onClick={(e) => handleSectionClick(e, section.id)}
              >
                {isSelected && (
                  <div className="sites-floating-toolbar" onClick={(e) => e.stopPropagation()}>
                    <span className="sites-floating-label">{SECTION_TYPE_LABELS[section.type]}</span>
                    {sectionSupportsQuickMedia(section.type) && (
                      <button
                        type="button"
                        className="sites-float-btn"
                        onClick={() =>
                          openMediaPicker({
                            storeId,
                            assetKey: `${section.id}-quick`,
                            title: 'Choose image',
                            onSelect: (url) => {
                              const patch = applyMediaUrlToSection(section, url);
                              if (patch) onUpdateSection(section.id, patch);
                            },
                          })
                        }
                      >
                        Image
                      </button>
                    )}
                    <button type="button" className="sites-float-btn" onClick={() => onDuplicateSection(section.id)} title="Duplicate">
                      Duplicate
                    </button>
                    <button type="button" className="sites-float-btn danger" onClick={() => onRemoveSection(section.id)} title="Delete">
                      Delete
                    </button>
                  </div>
                )}

                <div className="grid-section-content">
                  <SectionRenderer
                    section={section}
                    theme={theme}
                    storeId={storeId}
                    editMode={isSelected}
                    onUpdateSection={(updates) => onUpdateSection(section.id, updates)}
                  />
                </div>

                {isSelected && (
                  <div
                    className="grid-resize-handle"
                    onMouseDown={(e) => handleResizeStart(e, section.id)}
                    title="Resize"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
