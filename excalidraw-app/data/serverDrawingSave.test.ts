import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelServerDrawingSave,
  queueServerDrawingSave,
  setServerDrawingId,
  setServerDrawingSavePaused,
} from "./serverDrawingSave";
import { updateDrawing } from "./serverApi";

vi.mock("@excalidraw/excalidraw/data/json", () => ({
  serializeAsJSON: () => JSON.stringify({ elements: [], appState: {} }),
}));

vi.mock("./serverApi", () => ({
  updateDrawing: vi.fn(),
}));

const queueSave = () => {
  queueServerDrawingSave(
    [] as Parameters<typeof queueServerDrawingSave>[0],
    {} as Parameters<typeof queueServerDrawingSave>[1],
    {} as Parameters<typeof queueServerDrawingSave>[2],
  );
};

afterEach(() => {
  cancelServerDrawingSave();
  setServerDrawingId(null);
  setServerDrawingSavePaused(false);
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("server drawing save", () => {
  it("cancels a pending trailing save", () => {
    vi.useFakeTimers();
    setServerDrawingId("drawing-1");

    queueSave();
    expect(updateDrawing).toHaveBeenCalledTimes(1);

    queueSave();
    cancelServerDrawingSave();
    vi.advanceTimersByTime(1_000);

    expect(updateDrawing).toHaveBeenCalledTimes(1);
  });

  it("does not save while detached or paused", () => {
    vi.useFakeTimers();

    setServerDrawingId(null);
    queueSave();

    setServerDrawingId("drawing-1");
    setServerDrawingSavePaused(true);
    queueSave();
    vi.advanceTimersByTime(1_000);

    expect(updateDrawing).not.toHaveBeenCalled();
  });
});
