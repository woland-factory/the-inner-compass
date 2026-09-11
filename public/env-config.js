// Committed default: empty values. The container entrypoint overwrites this
// file from environment variables at deploy time. The app runs correctly with
// these empty defaults.
window.__ENV__ = { SENTRY_DSN: "", UMAMI_URL: "", UMAMI_WEBSITE_ID: "" };
