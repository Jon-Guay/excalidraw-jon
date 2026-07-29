import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import { Provider, appJotaiStore } from "../app-jotai";
import { DrawingsList } from "../components/DrawingsList";
import { currentUserIdAtom } from "../data/currentUser";
import * as serverApi from "../data/serverApi";

vi.mock("../components/UserSwitcher", () => ({
  UserSwitcher: () => <div>Persona</div>,
}));

vi.mock("../data/serverApi", () => ({
  isServerConfigured: vi.fn(() => true),
  listDrawings: vi.fn(),
  createDrawing: vi.fn(),
  deleteDrawing: vi.fn(),
  archiveDrawing: vi.fn(),
  restoreDrawing: vi.fn(),
}));

describe("DrawingsList archive flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appJotaiStore.set(currentUserIdAtom, "user-alice");
  });

  it("hides archived drawings by default and restores with show archived", async () => {
    let archived = false;

    const activeDrawing = {
      id: "drawing-1",
      ownerId: "user-alice",
      title: "Roadmap sketch",
      scene: {},
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const archivedDrawing = {
      ...activeDrawing,
      archivedAt: "2026-01-02T00:00:00.000Z",
    };

    const listDrawingsMock = vi.mocked(serverApi.listDrawings);
    const archiveDrawingMock = vi.mocked(serverApi.archiveDrawing);
    const restoreDrawingMock = vi.mocked(serverApi.restoreDrawing);

    listDrawingsMock.mockImplementation(async (_ownerId, includeArchived) => ({
      drawings: includeArchived
        ? archived
          ? [archivedDrawing]
          : [activeDrawing]
        : archived
          ? []
          : [activeDrawing],
    }));

    archiveDrawingMock.mockImplementation(async () => {
      archived = true;
      return { drawing: archivedDrawing };
    });

    restoreDrawingMock.mockImplementation(async () => {
      archived = false;
      return { drawing: activeDrawing };
    });

    await render(
      <Provider store={appJotaiStore}>
        <DrawingsList />
      </Provider>,
    );

    expect(await screen.findByText("Roadmap sketch")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(archiveDrawingMock).toHaveBeenCalledWith("drawing-1"));
    await waitFor(() =>
      expect(screen.queryByText("Roadmap sketch")).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    expect(await screen.findByText("Roadmap sketch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(restoreDrawingMock).toHaveBeenCalledWith("drawing-1"));

    fireEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    expect(await screen.findByText("Roadmap sketch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });
});
