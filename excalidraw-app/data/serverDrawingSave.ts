import throttle from "lodash.throttle";

import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "../app_constants";

import { updateDrawing } from "./serverApi";

let activeDrawingId: string | null = null;

export const setServerDrawingId = (drawingId: string | null) => {
  activeDrawingId = drawingId;
};

const saveDrawingToServer = throttle(
  (
    drawingId: string,
    elements: Parameters<typeof serializeAsJSON>[0],
    appState: Parameters<typeof serializeAsJSON>[1],
    files: Parameters<typeof serializeAsJSON>[2],
  ) => {
    const scene = JSON.parse(
      serializeAsJSON(elements, appState, files, "database"),
    );
    void updateDrawing(drawingId, { scene });
  },
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
);

export const queueServerDrawingSave = (
  elements: Parameters<typeof serializeAsJSON>[0],
  appState: Parameters<typeof serializeAsJSON>[1],
  files: Parameters<typeof serializeAsJSON>[2],
) => {
  if (!activeDrawingId) {
    return;
  }
  saveDrawingToServer(activeDrawingId, elements, appState, files);
};
