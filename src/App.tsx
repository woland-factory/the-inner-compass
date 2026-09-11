import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@sentry/react";
import { Shell } from "./shell/Shell";
import { Landing } from "./screens/Landing";
import { ErrorFallback } from "./observability/ErrorFallback";

export function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Landing />} />
            {/* Later epics add /guess, /reveal, /record, /settings here. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
