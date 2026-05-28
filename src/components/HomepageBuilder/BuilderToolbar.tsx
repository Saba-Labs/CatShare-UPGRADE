import React from 'react';
import { formatPublishDate } from '../../utils/homepagePublish';

export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface BuilderToolbarProps {
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;
  pageLabel: string;
  viewport: ViewportSize;
  publishedAt: string | null | undefined;
  hasUnpublishedChanges: boolean;
  isLive: boolean;
  canViewLive: boolean;
  onViewportChange: (size: ViewportSize) => void;
  onSave: () => void;
  onPublish: () => void;
  onViewLive: () => void;
  onOpenHistory: () => void;
  onPreview: () => void;
  showPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClose?: () => void;
}

const VIEWPORTS: Array<{ id: ViewportSize; label: string; icon: string }> = [
  { id: 'desktop', label: 'Desktop', icon: '▭' },
  { id: 'tablet', label: 'Tablet', icon: '▢' },
  { id: 'mobile', label: 'Mobile', icon: '▯' },
];

export default function BuilderToolbar({
  isDirty,
  isSaving,
  isPublishing,
  error,
  pageLabel,
  viewport,
  publishedAt,
  hasUnpublishedChanges,
  isLive,
  canViewLive,
  onViewportChange,
  onSave,
  onPublish,
  onViewLive,
  onOpenHistory,
  onPreview,
  showPreview,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClose,
}: BuilderToolbarProps) {
  const statusText = error
    ? `Error: ${error}`
    : isPublishing
      ? 'Publishing…'
      : isSaving
        ? 'Saving…'
        : isDirty
          ? 'Draft unsaved'
          : hasUnpublishedChanges
            ? 'Unpublished changes'
            : isLive
              ? `Live · ${formatPublishDate(publishedAt)}`
              : 'Draft saved';

  const statusClass = error
    ? 'error'
    : isPublishing || isSaving
      ? 'saving'
      : isDirty || hasUnpublishedChanges
        ? 'dirty'
        : isLive
          ? 'live'
          : 'saved';

  return (
    <header className="builder-toolbar sites-toolbar">
      <div className="toolbar-left">
        <span className="toolbar-site-name">CatShare Sites</span>
        <span className="toolbar-page-name">{pageLabel}</span>
        <span className={`toolbar-status-pill ${statusClass}`}>{statusText}</span>
      </div>

      <div className="toolbar-center">
        <div className="viewport-switcher" role="group" aria-label="Preview size">
          {VIEWPORTS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`viewport-btn ${viewport === id ? 'active' : ''}`}
              onClick={() => onViewportChange(id)}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
        <button type="button" className="btn-icon-tool" onClick={onUndo} disabled={!canUndo} title="Undo">
          ↶
        </button>
        <button type="button" className="btn-icon-tool" onClick={onRedo} disabled={!canRedo} title="Redo">
          ↷
        </button>
      </div>

      <div className="toolbar-right">
        <button type="button" className="btn-secondary btn-ghost" onClick={onOpenHistory} title="Version history">
          History
        </button>
        {canViewLive && (
          <button type="button" className="btn-secondary btn-ghost" onClick={onViewLive} disabled={!isLive} title={isLive ? 'Open live storefront' : 'Publish first to view live'}>
            View live
          </button>
        )}
        <button type="button" className="btn-secondary btn-ghost" onClick={onPreview}>
          {showPreview ? 'Editor' : 'Preview'}
        </button>
        <button type="button" className="btn-secondary btn-ghost" onClick={onSave} disabled={isPublishing}>
          Save draft
        </button>
        <button type="button" className="btn-primary" onClick={onPublish} disabled={isPublishing || isSaving}>
          {isPublishing ? 'Publishing…' : 'Publish'}
        </button>
        {onClose && (
          <button type="button" className="btn-secondary btn-ghost" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </header>
  );
}
