import { afterEach, describe, expect, it } from "vitest";
import { initAnalytics } from "./umami";

type EnvWindow = Window & { __ENV__?: unknown };

function setEnv(value: unknown) {
  (window as EnvWindow).__ENV__ = value;
}

function umamiScripts() {
  return Array.from(
    document.querySelectorAll<HTMLScriptElement>("#umami-analytics"),
  );
}

afterEach(() => {
  delete (window as EnvWindow).__ENV__;
  umamiScripts().forEach((s) => s.remove());
});

describe("initAnalytics", () => {
  it("appends exactly one script with the correct src and website id when both vars are set", () => {
    setEnv({
      UMAMI_URL: "https://analytics.example.com/script.js",
      UMAMI_WEBSITE_ID: "site-42",
    });
    initAnalytics();

    const scripts = umamiScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://analytics.example.com/script.js");
    expect(scripts[0].getAttribute("data-website-id")).toBe("site-42");
    expect(scripts[0].async).toBe(true);
  });

  it("does not double-inject when called twice", () => {
    setEnv({
      UMAMI_URL: "https://analytics.example.com/script.js",
      UMAMI_WEBSITE_ID: "site-42",
    });
    initAnalytics();
    initAnalytics();
    expect(umamiScripts()).toHaveLength(1);
  });

  it("injects nothing when the url is missing", () => {
    setEnv({ UMAMI_WEBSITE_ID: "site-42" });
    initAnalytics();
    expect(umamiScripts()).toHaveLength(0);
  });

  it("injects nothing when the website id is missing", () => {
    setEnv({ UMAMI_URL: "https://analytics.example.com/script.js" });
    initAnalytics();
    expect(umamiScripts()).toHaveLength(0);
  });

  it("does nothing and does not throw when env is unset", () => {
    delete (window as EnvWindow).__ENV__;
    expect(() => initAnalytics()).not.toThrow();
    expect(umamiScripts()).toHaveLength(0);
  });
});
