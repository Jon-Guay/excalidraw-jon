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

const drawingsCache = new Map<string, Drawing[]>();
const drawingsRequests = new Map<string, ReturnType<typeof listDrawings>>();

const loadDrawings = (ownerId: string, force: boolean) => {
  if (force) {
    drawingsRequests.delete(ownerId);
  }
  const pending =
    drawingsRequests.get(ownerId) ??
    listDrawings(ownerId).then((response) => {
      if (response) {
        drawingsCache.set(ownerId, response.drawings);
      } else {
        drawingsRequests.delete(ownerId);
      }
      return response;
    });
  drawingsRequests.set(ownerId, pending);
  return pending;
};

export const preloadDrawings = (ownerId: string) =>
  loadDrawings(ownerId, false);

export const DrawingsList = () => {
  const currentUserId = useAtomValue(currentUserIdAtom);
  const [drawings, setDrawings] = useState<Drawing[]>(
    currentUserId ? drawingsCache.get(currentUserId) ?? [] : [],
  );
  const [loading, setLoading] = useState(
    currentUserId ? !drawingsCache.has(currentUserId) : false,
  );
  const serverConfigured = isServerConfigured();

  const refresh = useCallback(
    async (force = false) => {
      if (!currentUserId) {
        setDrawings([]);
        return;
      }
      const cachedDrawings = drawingsCache.get(currentUserId);
      if (!force && cachedDrawings) {
        setDrawings(cachedDrawings);
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await loadDrawings(currentUserId, force);
      setDrawings(response?.drawings ?? []);
      setLoading(false);
    },
    [currentUserId],
  );

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
      await refresh(true);
      openDrawing(response.drawing.id);
    }
  };

  const handleDelete = async (drawingId: string) => {
    await deleteDrawing(drawingId);
    await refresh(true);
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
