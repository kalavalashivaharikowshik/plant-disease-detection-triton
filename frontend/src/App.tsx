import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AboutPage } from "./pages/AboutPage";
import { FieldPage } from "./pages/FieldPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LivePage } from "./pages/LivePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ScanPage } from "./pages/ScanPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ScanPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/field" element={<FieldPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
