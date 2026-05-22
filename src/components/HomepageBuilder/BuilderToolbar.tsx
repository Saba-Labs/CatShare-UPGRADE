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
  return (
    <div className="builder-toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-title">Homepage Builder</h1>
        <div className="toolbar-status">
          <span className={`status-indicator ${isSaving ? 'saving' : 'saved'}`}></span>
          {error ? (
            <span style={{ color: '#dc2626' }}>Error: {error}</span>
          ) : isSaving ? (
            <span>Auto-saving...</span>
          ) : isDirty ? (
            <span>Unsaved changes</span>
          ) : (
            <span>All changes saved</span>
          )}
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
          Save
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
