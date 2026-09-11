// Umami analytics. Injects the tracker script only when both config values are
// present. A complete no-op otherwise. Never throws.

import { readEnv } from "../config/env";

const SCRIPT_ID = "umami-analytics";

export function initAnalytics(): void {
  try {
    if (typeof document === "undefined") return;

    const { umamiUrl, umamiWebsiteId } = readEnv();
    if (!umamiUrl || !umamiWebsiteId) return;

    // Inject at most once per load.
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = umamiUrl;
    script.setAttribute("data-website-id", umamiWebsiteId);
    document.head.appendChild(script);
  } catch {
    // Analytics must never break the app.
  }
}
