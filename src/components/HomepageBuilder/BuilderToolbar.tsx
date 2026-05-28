import React from 'react';

interface BuilderToolbarProps {
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
  onSaveNow: () => void;
  onPreview: () => void;
  showPreview: boolean;
  onClose?: () => void;
}

export default function BuilderToolbar({
  isDirty,
  isSaving,
  error,
  onSave,
  onSaveNow,
  onPreview,
  showPreview,
  onClose,
}: BuilderToolbarProps) {
  const statusText = error
    ? `Error: ${error}`
    : isSaving
      ? 'Auto-saving changes...'
      : isDirty
        ? 'Unsaved changes'
        : 'All changes saved';

  return (
    <div className="builder-toolbar">
      <div className="toolbar-left">
        <div className="toolbar-badge">CatShare Sites</div>
        <h1 className="toolbar-title">Homepage Editor</h1>
        <div className="toolbar-status">
          <span className={`status-indicator ${isSaving ? 'saving' : 'saved'}`}></span>
          <span style={error ? { color: '#dc2626' } : undefined}>{statusText}</span>
        </div>
      </div>

      <div className="toolbar-center">
        <button
          className="btn-secondary"
          onClick={onPreview}
          title={showPreview ? 'Back to Editor' : 'Preview Changes'}
        >
          {showPreview ? '← Back to Editor' : 'Preview →'}
        </button>
      </div>

      <div className="toolbar-right">
        <button className="btn-primary" onClick={onSaveNow} title="Save changes immediately">
          Publish
        </button>

        {onClose && (
          <button className="btn-secondary" onClick={onClose} title="Close builder">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
