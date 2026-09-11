import { afterEach, describe, expect, it } from "vitest";
import { readEnv } from "./env";

type EnvWindow = Window & { __ENV__?: unknown };

function setEnv(value: unknown) {
  (window as EnvWindow).__ENV__ = value;
}

afterEach(() => {
  delete (window as EnvWindow).__ENV__;
});

describe("readEnv", () => {
  it("returns all fields unset when window.__ENV__ is undefined", () => {
    delete (window as EnvWindow).__ENV__;
    expect(readEnv()).toEqual({
      sentryDsn: undefined,
      umamiUrl: undefined,
      umamiWebsiteId: undefined,
    });
  });

  it("treats empty and whitespace-only strings as unset", () => {
    setEnv({ SENTRY_DSN: "", UMAMI_URL: "   ", UMAMI_WEBSITE_ID: "" });
    expect(readEnv()).toEqual({
      sentryDsn: undefined,
      umamiUrl: undefined,
      umamiWebsiteId: undefined,
    });
  });

  it("reads populated values back", () => {
    setEnv({
      SENTRY_DSN: "https://key@example.com/1",
      UMAMI_URL: "https://analytics.example.com/script.js",
      UMAMI_WEBSITE_ID: "abc-123",
    });
    expect(readEnv()).toEqual({
      sentryDsn: "https://key@example.com/1",
      umamiUrl: "https://analytics.example.com/script.js",
      umamiWebsiteId: "abc-123",
    });
  });

  it("does not throw when __ENV__ is not an object", () => {
    setEnv("nonsense");
    expect(() => readEnv()).not.toThrow();
    expect(readEnv().sentryDsn).toBeUndefined();
  });
});
