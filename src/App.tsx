import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./routes/AdminLayout";
import { VoterLayout } from "./routes/VoterLayout";
import { FullPageSpinner } from "./components/Spinner";

// Lazy-load route trees so the voter ballot (most panelists are on mobile) never pulls
// in the admin app or charting libraries, and vice-versa.
const LoginPage = lazy(() => import("./features/admin/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("./features/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const TestEditorPage = lazy(() => import("./features/admin/TestEditorPage").then((m) => ({ default: m.TestEditorPage })));
const ResultsPage = lazy(() => import("./features/admin/ResultsPage").then((m) => ({ default: m.ResultsPage })));
const BallotPage = lazy(() => import("./features/voter/BallotPage").then((m) => ({ default: m.BallotPage })));
const NotFoundPage = lazy(() => import("./features/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin portal — gated by auth + admin profile */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tests/new" element={<TestEditorPage mode="new" />} />
          <Route path="tests/:id" element={<TestEditorPage mode="edit" />} />
          <Route path="tests/:id/results" element={<ResultsPage />} />
        </Route>

        {/* Voter portal — public, token-gated, minimal shell */}
        <Route path="/vote/:token" element={<VoterLayout />}>
          <Route index element={<BallotPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
