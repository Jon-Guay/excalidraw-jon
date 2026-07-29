import React, { useCallback, useEffect, useState } from "react";

import { useAtomValue } from "../app-jotai";
import { currentUserIdAtom } from "../data/currentUser";
import {
  archiveDrawing,
  createDrawing,
  deleteDrawing,
  isServerConfigured,
  listDrawings,
  restoreDrawing,
  type Drawing,
} from "../data/serverApi";
import { setServerDrawingSavePaused } from "../data/serverDrawingSave";

import { UserSwitcher } from "./UserSwitcher";

import "./DrawingsList.scss";

export const DrawingsList = () => {
  const currentUserId = useAtomValue(currentUserIdAtom);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const serverConfigured = isServerConfigured();

  const refresh = useCallback(async () => {
    if (!currentUserId) {
      setDrawings([]);
      return;
    }
    setLoading(true);
    const response = await listDrawings(currentUserId, {
      includeArchived: showArchived,
    });
    setDrawings(response?.drawings ?? []);
    setLoading(false);
  }, [currentUserId, showArchived]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openDrawing = (drawingId: string) => {
    setServerDrawingSavePaused(true);
    window.history.replaceState({}, "", `#drawing=${drawingId}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const handleCreate = async () => {
    if (!currentUserId) {
      return;
    }
    const response = await createDrawing({
      ownerId: currentUserId,
      title: `Drawing ${drawings.length + 1}`,
    });
    if (response?.drawing) {
      await refresh();
      openDrawing(response.drawing.id);
    }
  };

  const handleDelete = async (drawingId: string) => {
    await deleteDrawing(drawingId);
    await refresh();
  };

  const handleArchive = async (drawingId: string) => {
    await archiveDrawing(drawingId);
    await refresh();
  };

  const handleRestore = async (drawingId: string) => {
    await restoreDrawing(drawingId);
    await refresh();
  };

  return (
    <div className="drawings-list">
      <div className="drawings-list__persona">
        <UserSwitcher />
      </div>
      {!serverConfigured ? (
        <p>Server drawings require VITE_APP_SERVER_URL.</p>
      ) : !currentUserId ? null : (
        <>
          <div className="drawings-list__header">
            <h3>Drawings</h3>
            <div className="drawings-list__header-actions">
              <label className="drawings-list__show-archived">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) =>
                    setShowArchived(event.currentTarget.checked)
                  }
                />
                Show archived
              </label>
              <button type="button" onClick={handleCreate}>
                New
              </button>
            </div>
          </div>
          {loading ? <p>Loading…</p> : null}
          <ul className="drawings-list__items">
            {drawings.map((drawing) => (
              <li key={drawing.id}>
                <button
                  type="button"
                  className="drawings-list__open"
                  onClick={() => openDrawing(drawing.id)}
                >
                  {drawing.title}
                </button>
                {drawing.archivedAt ? (
                  <button
                    type="button"
                    className="drawings-list__archive"
                    onClick={() => handleRestore(drawing.id)}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="drawings-list__archive"
                    onClick={() => handleArchive(drawing.id)}
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  className="drawings-list__delete"
                  onClick={() => handleDelete(drawing.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
