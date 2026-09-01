import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appJotaiStore, Provider } from "../app-jotai";
import { DrawingsList } from "../components/DrawingsList";
import {
  activeDrawingIdAtom,
  currentUserIdAtom,
  sceneResetRequestAtom,
} from "../data/currentUser";
import {
  archiveDrawing,
  listDrawings,
  restoreDrawing,
} from "../data/serverApi";
import {
  cancelServerDrawingSave,
  setServerDrawingId,
  setServerDrawingSavePaused,
} from "../data/serverDrawingSave";

vi.mock("../components/UserSwitcher", () => ({
  UserSwitcher: () => <div>Persona</div>,
}));

vi.mock("../data/serverApi", () => ({
  archiveDrawing: vi.fn(),
  createDrawing: vi.fn(),
  isServerConfigured: () => true,
  listDrawings: vi.fn(),
  restoreDrawing: vi.fn(),
}));

vi.mock("../data/serverDrawingSave", () => ({
  cancelServerDrawingSave: vi.fn(),
  setServerDrawingId: vi.fn(),
  setServerDrawingSavePaused: vi.fn(),
}));

const makeDrawing = (id: string, archivedAt: string | null = null) => ({
  id,
  ownerId: "user-alice",
  title: "Drawing 1",
  scene: { elements: [], appState: {} },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  archivedAt,
});

const renderList = (ownerId: string, activeDrawingId: string | null) => {
  appJotaiStore.set(currentUserIdAtom, ownerId);
  appJotaiStore.set(activeDrawingIdAtom, activeDrawingId);
  appJotaiStore.set(sceneResetRequestAtom, 0);
  return render(
    <Provider store={appJotaiStore}>
      <DrawingsList />
    </Provider>,
  );
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

describe("DrawingsList archive lifecycle", () => {
  it("detaches and requests a canvas reset after archiving the active drawing", async () => {
    const drawing = makeDrawing("active-drawing");
    vi.mocked(listDrawings)
      .mockResolvedValueOnce({ drawings: [drawing] })
      .mockResolvedValue({ drawings: [] });
    vi.mocked(archiveDrawing).mockResolvedValue({
      drawing: {
        ...drawing,
        archivedAt: "2026-09-01T01:00:00.000Z",
      },
    });

    renderList("archive-success-owner", drawing.id);
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(appJotaiStore.get(activeDrawingIdAtom)).toBeNull();
      expect(appJotaiStore.get(sceneResetRequestAtom)).toBe(1);
    });
    expect(setServerDrawingSavePaused).toHaveBeenNthCalledWith(1, true);
    expect(cancelServerDrawingSave).toHaveBeenCalledOnce();
    expect(setServerDrawingId).toHaveBeenCalledWith(null);
    expect(setServerDrawingSavePaused).toHaveBeenLastCalledWith(false);
  });

  it("keeps the drawing attached when archiving fails", async () => {
    const drawing = makeDrawing("failed-drawing");
    vi.mocked(listDrawings).mockResolvedValue({ drawings: [drawing] });
    vi.mocked(archiveDrawing).mockResolvedValue(null);

    renderList("archive-failure-owner", drawing.id);
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(archiveDrawing).toHaveBeenCalledWith(drawing.id);
      expect(setServerDrawingSavePaused).toHaveBeenLastCalledWith(false);
    });
    expect(appJotaiStore.get(activeDrawingIdAtom)).toBe(drawing.id);
    expect(appJotaiStore.get(sceneResetRequestAtom)).toBe(0);
    expect(setServerDrawingId).not.toHaveBeenCalled();
  });

  it("reopens the preserved scene after restoring succeeds", async () => {
    const drawing = makeDrawing("archived-drawing", "2026-09-01T01:00:00.000Z");
    vi.mocked(listDrawings).mockResolvedValue({ drawings: [drawing] });
    vi.mocked(restoreDrawing).mockResolvedValue({
      drawing: { ...drawing, archivedAt: null },
    });

    renderList("restore-owner", null);
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(window.location.hash).toBe(`#drawing=${drawing.id}`);
    });
    expect(restoreDrawing).toHaveBeenCalledWith(drawing.id);
    expect(setServerDrawingSavePaused).toHaveBeenCalledWith(true);
  });
});
