import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Drawing } from "../data/serverApi";

const listDrawings = vi.fn();
const archiveDrawing = vi.fn();
const restoreDrawing = vi.fn();
const createDrawing = vi.fn();

vi.mock("../data/currentUser", async () => {
  const { atom } = await import("../app-jotai");
  return {
    currentUserIdAtom: atom("user-alice"),
    persistCurrentUserId: vi.fn(),
    activeDrawingIdAtom: atom<string | null>(null),
  };
});

vi.mock("../data/serverApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/serverApi")>();
  return {
    ...actual,
    isServerConfigured: () => true,
    listDrawings: (...args: unknown[]) => listDrawings(...args),
    archiveDrawing: (...args: unknown[]) => archiveDrawing(...args),
    restoreDrawing: (...args: unknown[]) => restoreDrawing(...args),
    createDrawing: (...args: unknown[]) => createDrawing(...args),
    listUsers: () =>
      Promise.resolve({
        users: [{ id: "user-alice", name: "Alice", createdAt: "" }],
      }),
  };
});

vi.mock("../components/UserSwitcher", () => ({
  UserSwitcher: () => <div data-testid="user-switcher" />,
}));

import {
  DrawingsList,
  resetDrawingsListCacheForTests,
} from "../components/DrawingsList";

const activeDrawing: Drawing = {
  id: "drawing-active",
  ownerId: "user-alice",
  title: "Active",
  scene: {},
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
  archivedAt: null,
};

const archivedDrawing: Drawing = {
  ...activeDrawing,
  id: "drawing-archived",
  title: "Archived",
  archivedAt: "2020-02-01T00:00:00.000Z",
};

describe("DrawingsList", () => {
  beforeEach(() => {
    resetDrawingsListCacheForTests();
    listDrawings.mockReset();
    archiveDrawing.mockReset();
    restoreDrawing.mockReset();
    createDrawing.mockReset();
    listDrawings.mockImplementation(
      (_ownerId: string, includeArchived?: boolean) =>
        Promise.resolve({
          drawings: includeArchived
            ? [activeDrawing, archivedDrawing]
            : [activeDrawing],
        }),
    );
    archiveDrawing.mockResolvedValue({ drawing: archivedDrawing });
    restoreDrawing.mockResolvedValue({ drawing: activeDrawing });
  });

  it("loads active drawings by default and fetches archived when toggled", async () => {
    render(<DrawingsList />);

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeTruthy();
    });
    expect(listDrawings).toHaveBeenCalledWith("user-alice", false);
    expect(screen.queryByText("Archived")).toBeNull();

    fireEvent.click(screen.getByLabelText("Show archived"));

    await waitFor(() => {
      expect(screen.getByText("Archived")).toBeTruthy();
    });
    expect(listDrawings).toHaveBeenCalledWith("user-alice", true);
  });

  it("calls archive and restore helpers and refreshes the list", async () => {
    render(<DrawingsList />);

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(archiveDrawing).toHaveBeenCalledWith("drawing-active");
    });
    expect(
      listDrawings.mock.calls.filter((c) => c[1] === false).length,
    ).toBeGreaterThan(1);

    fireEvent.click(screen.getByLabelText("Show archived"));
    await waitFor(() => {
      expect(screen.getByText("Archived")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(restoreDrawing).toHaveBeenCalledWith("drawing-archived");
    });
  });

  it("does not reuse cached active-only results when show archived is enabled", async () => {
    render(<DrawingsList />);

    await waitFor(() => {
      expect(listDrawings).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByLabelText("Show archived"));

    await waitFor(() => {
      expect(listDrawings).toHaveBeenCalledTimes(2);
    });
    expect(listDrawings.mock.calls[1]).toEqual(["user-alice", true]);
  });
});
