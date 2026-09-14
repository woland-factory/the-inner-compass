import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@sentry/react";
import { Shell } from "./shell/Shell";
import { Landing } from "./screens/Landing";
import { GuessFlow } from "./screens/GuessFlow";
import { ErrorFallback } from "./observability/ErrorFallback";

export function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Landing />} />
            <Route path="/guess" element={<GuessFlow />} />
            {/* /reveal stays reserved; the loop lives entirely on /guess. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
