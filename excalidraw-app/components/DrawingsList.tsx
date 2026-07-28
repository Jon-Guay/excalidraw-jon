import React, { useCallback, useEffect, useState } from "react";

import { useAtomValue } from "../app-jotai";
import { currentUserIdAtom } from "../data/currentUser";
import {
  createDrawing,
  deleteDrawing,
  isServerConfigured,
  listDrawings,
  type Drawing,
} from "../data/serverApi";
import { setServerDrawingSavePaused } from "../data/serverDrawingSave";

import { UserSwitcher } from "./UserSwitcher";

import "./DrawingsList.scss";

export const DrawingsList = () => {
  const currentUserId = useAtomValue(currentUserIdAtom);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(false);
  const serverConfigured = isServerConfigured();

  const refresh = useCallback(async () => {
    if (!currentUserId) {
      setDrawings([]);
      return;
    }
    setLoading(true);
    const response = await listDrawings(currentUserId);
    setDrawings(response?.drawings ?? []);
    setLoading(false);
  }, [currentUserId]);

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
            <button type="button" onClick={handleCreate}>
              New
            </button>
          </div>
          {loading ? <p>Loading…</p> : null}
          <ul className="drawings-list__items">
            {drawings.map((drawing) => (
              <li key={drawing.id}>
                <button type="button" onClick={() => openDrawing(drawing.id)}>
                  {drawing.title}
                </button>
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
