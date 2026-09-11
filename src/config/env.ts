// Runtime config read from window.__ENV__, injected by public/env-config.js.
// Static SPAs cannot read process env at runtime, so the container entrypoint
// rewrites env-config.js from the container environment at deploy time.

export type AppEnv = {
  sentryDsn?: string;
  umamiUrl?: string;
  umamiWebsiteId?: string;
};

type RawEnv = {
  SENTRY_DSN?: unknown;
  UMAMI_URL?: unknown;
  UMAMI_WEBSITE_ID?: unknown;
};

// Treat empty strings and non-strings as "unset".
function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readEnv(): AppEnv {
  const raw: RawEnv =
    (typeof window !== "undefined" &&
      (window as { __ENV__?: RawEnv }).__ENV__) ||
    {};
  return {
    sentryDsn: clean(raw.SENTRY_DSN),
    umamiUrl: clean(raw.UMAMI_URL),
    umamiWebsiteId: clean(raw.UMAMI_WEBSITE_ID),
  };
}
