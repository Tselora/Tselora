import { Navigate, Route, Routes } from "react-router-dom";

import { RunPage } from "./pages/RunPage";

export function App() {
  return (
    <Routes>
      <Route path="/runs/:runId" element={<RunPage />} />
      <Route path="/" element={<RunPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
