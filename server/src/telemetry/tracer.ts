export type ApiSpan = {
  name: string;
  attributes: Record<string, string>;
  startedAt: number;
  endedAt?: number;
};

let tracerInitialised = false;

export const initTracer = (): void => {
  if (tracerInitialised) {
    return;
  }
  tracerInitialised = true;
};

export const getTracer = () => ({
  initialised: tracerInitialised,
});
