import { Navigate, Route, Routes } from "react-router-dom";

import { ComparePage } from "./pages/ComparePage";
import { LearnPage } from "./pages/LearnPage";
import { RunPage } from "./pages/RunPage";

export function App() {
  return (
    <Routes>
      <Route path="/runs/:runId" element={<RunPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/" element={<RunPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
