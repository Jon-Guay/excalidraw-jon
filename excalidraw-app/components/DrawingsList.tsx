import React, { useCallback, useEffect, useState } from "react";

import { useAtomValue } from "../app-jotai";
import { currentUserIdAtom } from "../data/currentUser";
import {
  archiveDrawing,
  createDrawing,
  isServerConfigured,
  listDrawings,
  restoreDrawing,
  type Drawing,
} from "../data/serverApi";
import { setServerDrawingSavePaused } from "../data/serverDrawingSave";

import { UserSwitcher } from "./UserSwitcher";

import "./DrawingsList.scss";

const cacheKey = (ownerId: string, includeArchived: boolean) =>
  `${ownerId}:${includeArchived ? "all" : "active"}`;

const drawingsCache = new Map<string, Drawing[]>();
const drawingsRequests = new Map<string, ReturnType<typeof listDrawings>>();

const loadDrawings = (
  ownerId: string,
  force: boolean,
  includeArchived: boolean,
) => {
  const key = cacheKey(ownerId, includeArchived);

  if (force) {
    // Drop both the in-flight promise and the cache so remounts can't
    // rehydrate stale drawings and skip awaiting the newer fetch.
    drawingsRequests.delete(key);
    drawingsCache.delete(key);
  }

  const existing = drawingsRequests.get(key);
  if (existing) {
    return existing;
  }

  const pending = listDrawings(ownerId, { includeArchived }).then(
    (response) => {
      // A later force-refresh may have replaced this request; don't write back.
      if (drawingsRequests.get(key) !== pending) {
        return response;
      }
      if (response) {
        drawingsCache.set(key, response.drawings);
      } else {
        drawingsRequests.delete(key);
      }
      return response;
    },
  );
  drawingsRequests.set(key, pending);
  return pending;
};

export const preloadDrawings = (ownerId: string) =>
  loadDrawings(ownerId, false, false);

export const DrawingsList = () => {
  const currentUserId = useAtomValue(currentUserIdAtom);
  const [showArchived, setShowArchived] = useState(false);
  const activeCacheKey = currentUserId
    ? cacheKey(currentUserId, showArchived)
    : null;
  const [drawings, setDrawings] = useState<Drawing[]>(
    activeCacheKey ? drawingsCache.get(activeCacheKey) ?? [] : [],
  );
  const [loading, setLoading] = useState(
    activeCacheKey ? !drawingsCache.has(activeCacheKey) : false,
  );
  const serverConfigured = isServerConfigured();

  const refresh = useCallback(
    async (force = false) => {
      if (!currentUserId) {
        setDrawings([]);
        return;
      }
      const key = cacheKey(currentUserId, showArchived);
      const cachedDrawings = drawingsCache.get(key);
      if (!force && cachedDrawings) {
        setDrawings(cachedDrawings);
        setLoading(false);
        return;
      }
      setLoading(true);
      const response = await loadDrawings(currentUserId, force, showArchived);
      setDrawings(response?.drawings ?? []);
      setLoading(false);
    },
    [currentUserId, showArchived],
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

  const handleArchive = async (drawingId: string) => {
    await archiveDrawing(drawingId);
    await refresh(true);
  };

  const handleRestore = async (drawingId: string) => {
    await restoreDrawing(drawingId);
    await refresh(true);
  };

  const handleShowArchivedChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setShowArchived(event.target.checked);
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
          <label className="drawings-list__toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={handleShowArchivedChange}
            />
            Show archived
          </label>
          {loading ? <p>Loading…</p> : null}
          <ul className="drawings-list__items">
            {drawings.map((drawing) => (
              <li
                key={drawing.id}
                className={
                  drawing.archivedAt
                    ? "drawings-list__item--archived"
                    : undefined
                }
              >
                <button type="button" onClick={() => openDrawing(drawing.id)}>
                  {drawing.title}
                </button>
                {drawing.archivedAt ? (
                  <button
                    type="button"
                    className="drawings-list__action"
                    onClick={() => handleRestore(drawing.id)}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="drawings-list__action"
                    onClick={() => handleArchive(drawing.id)}
                  >
                    Archive
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
