import { initTracer } from "./tracer.js";

export type ApiSpanAttributes = {
  "excalidraw.api.route": string;
  "excalidraw.api.method": string;
};

export const withApiSpan = async <T>(
  operationName: string,
  attributes: ApiSpanAttributes,
  fn: () => Promise<T> | T,
): Promise<T> => {
  initTracer();
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    void operationName;
    void attributes;
    void startedAt;
  }
};
