// Error tracking. Initializes Sentry only when a DSN is configured. When the
// DSN is absent the SDK stays uninitialized and every Sentry call is a no-op.
// Never throws.

import * as Sentry from "@sentry/react";
import { readEnv } from "../config/env";

export function initSentry(): void {
  try {
    const { sentryDsn } = readEnv();
    if (!sentryDsn) return;

    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  } catch {
    // Error tracking must never break the app.
  }
}
