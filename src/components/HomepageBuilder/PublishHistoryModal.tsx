import React, { useState } from 'react';
import { PublishHistoryEntry } from '../../types/homepage';
import { formatPublishDate } from '../../utils/homepagePublish';

interface PublishHistoryModalProps {
  history: PublishHistoryEntry[];
  publishedAt: string | null | undefined;
  isRestoring: boolean;
  onClose: () => void;
  onRestoreDraft: (versionId: string) => void;
  onRestoreLive: (versionId: string) => void;
  onUnpublish: () => void;
}

export default function PublishHistoryModal({
  history,
  publishedAt,
  isRestoring,
  onClose,
  onRestoreDraft,
  onRestoreLive,
  onUnpublish,
}: PublishHistoryModalProps) {
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  return (
    <div className="media-picker-overlay publish-history-overlay" role="dialog" aria-modal="true" aria-label="Publish history">
      <div className="publish-history-modal">
        <header className="media-picker-header">
          <h3>Publish history</h3>
          <button type="button" className="media-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="publish-history-live">
          Live site last published: <strong>{formatPublishDate(publishedAt)}</strong>
        </p>

        {history.length === 0 ? (
          <p className="media-picker-empty">No published versions yet. Use Publish to make your site live.</p>
        ) : (
          <ul className="publish-history-list">
            {history.map((entry, index) => (
              <li key={entry.id} className="publish-history-row">
                <div className="publish-history-meta">
                  <span className="publish-history-date">{formatPublishDate(entry.publishedAt)}</span>
                  {index === 0 && <span className="publish-history-badge">Latest</span>}
                  {entry.note && <span className="publish-history-note">{entry.note}</span>}
                </div>
                <div className="publish-history-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-ghost btn-sm"
                    disabled={isRestoring}
                    onClick={() => onRestoreDraft(entry.id)}
                  >
                    Edit as draft
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={isRestoring}
                    onClick={() => onRestoreLive(entry.id)}
                  >
                    Publish again
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="publish-history-footer">
          {!confirmUnpublish ? (
            <button type="button" className="btn-text danger" onClick={() => setConfirmUnpublish(true)}>
              Unpublish live site
            </button>
          ) : (
            <div className="publish-unpublish-confirm">
              <span>Remove the live site? Draft is kept.</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmUnpublish(false)}>
                Cancel
              </button>
              <button type="button" className="btn-secondary btn-sm danger" disabled={isRestoring} onClick={onUnpublish}>
                Unpublish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
