import fs from "fs";

import { vi } from "vitest";

import { mockThrottleRAF } from "./packages/excalidraw/tests/helpers/mocks";
import { yellow } from "./packages/excalidraw/tests/helpers/colorize";
import {
  PolyfillLocalStorage,
  testPolyfills,
} from "./packages/excalidraw/tests/helpers/polyfills";

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();

  return {
    ...module,
    throttleRAF: mockThrottleRAF,
  };
});

vi.mock(
  "./packages/excalidraw/fonts/ExcalidrawFontFace",
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import("./packages/excalidraw/fonts/ExcalidrawFontFace")
    >();
    const ExcalidrawFontFaceImpl = mod.ExcalidrawFontFace;

    return {
      ...mod,
      ExcalidrawFontFace: class extends ExcalidrawFontFaceImpl {
        public async fetchFont(url: URL): Promise<ArrayBuffer> {
          if (!url.toString().startsWith("file://")) {
            return super.fetchFont(url);
          }

          const content = await fs.promises.readFile(url);
          return content.buffer;
        }
      },
    };
  },
);

const setupBrowserTests = async () => {
  if (typeof window === "undefined") {
    return;
  }

  await import("vitest-canvas-mock");
  await import("@testing-library/jest-dom");

  const { configure } = await import("@testing-library/react");
  const polyfill = (await import("./packages/excalidraw/polyfill")).default;

  Object.assign(globalThis, testPolyfills);
  PolyfillLocalStorage();

  const debugDom = ["true", "1"].includes(process.env.VITE_DEBUG_DOM ?? "");
  if (!debugDom) {
    configure({
      getElementError: (message) => {
        const error = new Error(message ?? undefined);
        error.name = "TestingLibraryElementError";
        return error;
      },
    });
  }

  HTMLElement.prototype.setPointerCapture = vi.fn();

  require("fake-indexeddb/auto");

  polyfill();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, "FontFace", {
    enumerable: true,
    value: class {
      status = "unloaded";
      unicodeRange = "U+0000-00FF";

      constructor(
        private family: string,
        private source: string,
        private descriptors: unknown,
      ) {}

      load() {
        this.status = "loaded";
      }
    },
  });

  Object.defineProperty(document, "fonts", {
    value: {
      load: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockResolvedValue(true),
      has: vi.fn().mockResolvedValue(true),
      add: vi.fn(),
    },
  });

  Object.defineProperty(window, "EXCALIDRAW_ASSET_PATH", {
    value: `file://${__dirname}/`,
  });

  const element = document.createElement("div");
  element.id = "root";
  document.body.appendChild(element);

  const _consoleError = console.error.bind(console);
  console.error = (...args) => {
    if (args[0]?.includes?.("act(")) {
      _consoleError(
        yellow(
          `<<< WARNING: test "${
            expect.getState().currentTestName
          }" does not wrap some state update in act() >>>`,
        ),
      );
    } else {
      _consoleError(...args);
    }
  };
};

await setupBrowserTests();
