import React, { useRef, useState } from 'react';
import { HomepageLayout, HomepageSection, GridPosition } from '../../types/homepage';
import SectionRenderer from './sections/SectionRenderer';
import './GridCanvas.css';

const GRID_COLUMNS = 12;
const GRID_GAP = 16;
const COLUMN_WIDTH = 60;

interface GridCanvasProps {
  layout: HomepageLayout;
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onUpdateSectionPosition: (id: string, position: GridPosition) => void;
}

export default function GridCanvas({
  layout,
  selectedSectionId,
  onSelectSection,
  onRemoveSection,
  onDuplicateSection,
  onUpdateSectionPosition,
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const getDefaultPosition = (index: number): GridPosition => ({
    column: 1,
    row: index + 1,
    width: GRID_COLUMNS,
    height: 1,
  });

  const getPositionStyle = (section: HomepageSection & { id: string; gridPosition?: GridPosition }) => {
    const pos = section.gridPosition || getDefaultPosition(layout.sections.indexOf(section));
    const columnWidth = COLUMN_WIDTH;
    const width = pos.width * columnWidth + (pos.width - 1) * (GRID_GAP / GRID_COLUMNS);
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

  const handleCanvasClick = () => {
    onSelectSection(null);
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const section = layout.sections.find((s) => s.id === id);
    if (!section) return;

    const pos = section.gridPosition || getDefaultPosition(layout.sections.indexOf(section));
    setResizingId(id);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: pos.width,
      height: pos.height,
    });
  };

  React.useEffect(() => {
    if (!resizingId || !resizeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.round((e.clientX - resizeStart.x) / (COLUMN_WIDTH + GRID_GAP / GRID_COLUMNS));
      const deltaY = Math.round((e.clientY - resizeStart.y) / 220);

      const newWidth = Math.max(1, Math.min(GRID_COLUMNS, resizeStart.width + deltaX));
      const newHeight = Math.max(1, resizeStart.height + deltaY);

      const section = layout.sections.find((s) => s.id === resizingId);
      if (section) {
        const pos = section.gridPosition || getDefaultPosition(layout.sections.indexOf(section));
        onUpdateSectionPosition(resizingId, {
          ...pos,
          width: newWidth,
          height: newHeight,
        });
      }
    };

    const handleMouseUp = () => {
      setResizingId(null);
      setResizeStart(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingId, resizeStart, layout, onUpdateSectionPosition]);

  return (
    <div className="grid-canvas-container" ref={canvasRef} onClick={handleCanvasClick}>
      {layout.sections.length === 0 ? (
        <div className="canvas-empty">
          <div style={{ textAlign: 'center' }}>
            <p>👈 Drag components from the left sidebar</p>
            <p>or</p>
            <p>click a component to add it to your homepage</p>
          </div>
        </div>
      ) : (
        <>
          <div
            className="grid-background"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
              gap: `${GRID_GAP}px`,
            }}
          >
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="grid-cell" />
            ))}
          </div>

          <div
            className="grid-container"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
              gap: `${GRID_GAP}px`,
            }}
          >
            {layout.sections.map((section) => (
              <div
                key={section.id}
                className={`grid-section ${selectedSectionId === section.id ? 'selected' : ''} ${resizingId === section.id ? 'resizing' : ''}`}
                style={getPositionStyle(section)}
                onClick={(e) => handleSectionClick(e, section.id)}
              >
                <div className="grid-section-toolbar">
                  <button
                    className="grid-tool-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateSection(section.id);
                    }}
                    title="Duplicate"
                  >
                    📋
                  </button>
                  <button
                    className="grid-tool-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSection(section.id);
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>

                <div className="grid-section-content">
                  <SectionRenderer section={section} editMode={true} />
                </div>

                {selectedSectionId === section.id && (
                  <div
                    className="grid-resize-handle"
                    onMouseDown={(e) => handleResizeStart(e, section.id)}
                    title="Drag to resize"
                  >
                    ⤡
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
