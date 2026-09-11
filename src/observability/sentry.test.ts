import { afterEach, describe, expect, it, vi } from "vitest";
import { initSentry } from "./sentry";

const init = vi.fn();
vi.mock("@sentry/react", () => ({
  init: (...args: unknown[]) => init(...args),
}));

type EnvWindow = Window & { __ENV__?: unknown };

function setEnv(value: unknown) {
  (window as EnvWindow).__ENV__ = value;
}

afterEach(() => {
  delete (window as EnvWindow).__ENV__;
  init.mockClear();
});

describe("initSentry", () => {
  it("calls Sentry.init once with sendDefaultPii false when a DSN is set", () => {
    setEnv({ SENTRY_DSN: "https://key@example.com/1" });

    initSentry();

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@example.com/1",
        sendDefaultPii: false,
      }),
    );
  });

  it("does not initialize Sentry when the DSN is unset", () => {
    delete (window as EnvWindow).__ENV__;

    initSentry();

    expect(init).not.toHaveBeenCalled();
  });

  it("does not throw", () => {
    delete (window as EnvWindow).__ENV__;
    expect(() => initSentry()).not.toThrow();
  });
});
