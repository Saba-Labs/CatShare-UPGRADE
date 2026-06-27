import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { FiEdit2, FiPackage, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import WarehouseShell from './components/WarehouseShell';
import { useWarehouse } from './WarehouseContext';
import type { InventoryRoom } from '../../types/inventory';
import { getCardAccent } from './warehouseUtils';

export default function WarehouseInventories() {
  const {
    loading,
    error,
    mainInventoryId,
    rooms,
    addRoom,
    renameRoom,
    deleteRoom,
    cataloguesForRoom,
  } = useWarehouse();
  const [newRoomName, setNewRoomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryRoom | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState<null | 'warn' | 'confirm'>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const linkedCatalogues = useMemo(
    () => (editTarget ? cataloguesForRoom(editTarget.id) : []),
    [editTarget, cataloguesForRoom]
  );
  const isDefaultInventory = editTarget?.id === mainInventoryId;

  useEffect(() => {
    if (!editTarget) return;
    setDeleteStep(null);
    const t = window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, [editTarget]);

  useEffect(() => {
    if (!editTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editSaving) setEditTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editTarget, editSaving]);

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) return;
    setSaving(true);
    await addRoom(newRoomName.trim());
    setNewRoomName('');
    setSaving(false);
  };

  const openEdit = (room: InventoryRoom, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteStep(null);
    setEditTarget(room);
    setRenameDraft(room.name);
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditTarget(null);
    setDeleteStep(null);
  };

  const handleRenameSave = async () => {
    if (!editTarget) return;
    const next = renameDraft.trim();
    if (!next) return;
    if (next !== editTarget.name) {
      setEditSaving(true);
      const ok = await renameRoom(editTarget, next);
      setEditSaving(false);
      if (!ok) return;
    }
    closeEdit();
  };

  const handleDeleteClick = () => {
    if (!editTarget || isDefaultInventory) return;
    if (linkedCatalogues.length > 0) {
      setDeleteStep('warn');
      return;
    }
    setDeleteStep('confirm');
  };

  const handleDeleteConfirm = async () => {
    if (!editTarget || isDefaultInventory || linkedCatalogues.length > 0) return;
    setEditSaving(true);
    const ok = await deleteRoom(editTarget);
    setEditSaving(false);
    if (ok) closeEdit();
    else setDeleteStep(null);
  };

  if (loading) {
    return (
      <WarehouseShell title="Warehouse" backTo="app">
        <div className="wh-spinner" />
      </WarehouseShell>
    );
  }

  return (
    <WarehouseShell title="Warehouse" backTo="app">
      {error ? <div className="wh-error">{error}</div> : null}

      <p className="wh-page-lead">
        Each card is a separate stock space. Open one to add or update quantities.
      </p>

      <div className="wh-space-grid">
        {rooms.map((room, index) => {
          const accent = getCardAccent(room.id, index);
          return (
            <div
              key={room.id}
              className="wh-space-card"
              style={
                {
                  '--space-bg': accent.bg,
                  '--space-border': accent.border,
                  '--space-icon': accent.icon,
                  '--space-stripe': accent.stripe,
                } as CSSProperties
              }
            >
              <div className="wh-space-card__stripe" aria-hidden />
              <div className="wh-space-card__body">
                <span className="wh-space-card__icon" aria-hidden>
                  <FiPackage size={22} />
                </span>
                <div className="wh-space-card__text">
                  <span className="wh-space-card__name">{room.name}</span>
                  {room.id === mainInventoryId ? (
                    <span className="wh-space-card__tag">Default</span>
                  ) : null}
                </div>
                <Link
                  to={`/warehouse/inventories/${room.id}`}
                  className="wh-space-card__btn wh-space-card__btn--primary wh-space-card__btn--full"
                >
                  <FiPlus size={15} />
                  Add stock
                </Link>
              </div>
              <button
                type="button"
                className="wh-space-card__edit"
                aria-label={`Edit ${room.name}`}
                onClick={(e) => openEdit(room, e)}
              >
                <FiEdit2 size={15} />
              </button>
            </div>
          );
        })}

        <div className="wh-space-card wh-space-card--add">
          <div className="wh-space-card__add-inner">
            <input
              className="wh-input wh-space-add-input"
              placeholder="New space name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newRoomName.trim()) void handleAddRoom();
              }}
            />
            <button
              type="button"
              className="wh-btn wh-space-add-btn"
              disabled={saving || !newRoomName.trim()}
              onClick={() => void handleAddRoom()}
            >
              <FiPlus size={18} />
              Add space
            </button>
          </div>
        </div>
      </div>

      {editTarget ? (
        <div className="wh-rename-overlay" role="presentation" onClick={closeEdit}>
          <div
            className="wh-rename-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wh-edit-inventory-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="wh-rename-header">
              <h2 id="wh-edit-inventory-title" className="wh-rename-title">
                Edit inventory
              </h2>
              <button
                type="button"
                className="wh-rename-close"
                aria-label="Close"
                disabled={editSaving}
                onClick={closeEdit}
              >
                <FiX size={20} />
              </button>
            </header>

            <label className="wh-rename-label" htmlFor="wh-rename-input">
              Name
            </label>
            <input
              id="wh-rename-input"
              ref={renameInputRef}
              className="wh-input wh-rename-input"
              value={renameDraft}
              disabled={editSaving}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameDraft.trim()) void handleRenameSave();
              }}
            />

            {!isDefaultInventory ? (
              <div className="wh-edit-delete">
                {deleteStep === 'warn' ? (
                  <p className="wh-edit-hint wh-edit-hint--warn">
                    Unlink this inventory from{' '}
                    <strong>{linkedCatalogues.map((c) => c.label).join(', ')}</strong> on the
                    Catalogues tab before deleting.
                  </p>
                ) : null}
                {deleteStep === 'confirm' ? (
                  <p className="wh-edit-delete-confirm">
                    Delete <strong>{editTarget.name}</strong> and all stock in this space? This
                    cannot be undone.
                  </p>
                ) : null}
                {deleteStep === 'warn' ? (
                  <button
                    type="button"
                    className="wh-btn secondary wh-edit-delete-cancel"
                    disabled={editSaving}
                    onClick={() => setDeleteStep(null)}
                  >
                    OK
                  </button>
                ) : deleteStep === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      className="wh-btn wh-edit-delete-btn confirm"
                      disabled={editSaving}
                      onClick={() => void handleDeleteConfirm()}
                    >
                      <FiTrash2 size={16} />
                      {editSaving ? 'Deleting…' : 'Yes, delete inventory'}
                    </button>
                    <button
                      type="button"
                      className="wh-btn secondary wh-edit-delete-cancel"
                      disabled={editSaving}
                      onClick={() => setDeleteStep(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="wh-btn wh-edit-delete-btn"
                    disabled={editSaving}
                    onClick={handleDeleteClick}
                  >
                    <FiTrash2 size={16} />
                    Delete inventory
                  </button>
                )}
              </div>
            ) : null}

            <div className="wh-rename-actions">
              <button
                type="button"
                className="wh-btn secondary wh-rename-cancel"
                disabled={editSaving}
                onClick={closeEdit}
              >
                Close
              </button>
              <button
                type="button"
                className="wh-btn wh-rename-save"
                disabled={editSaving || !renameDraft.trim()}
                onClick={() => void handleRenameSave()}
              >
                {editSaving ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </WarehouseShell>
  );
}
