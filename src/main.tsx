import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initSentry } from "./observability/sentry";
import { initAnalytics } from "./analytics/umami";
import { App } from "./App";
import "./styles/global.css";

// Wire observability and analytics before mounting. Both are safe no-ops when
// their env is unset and neither can throw.
initSentry();
initAnalytics();

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
