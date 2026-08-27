import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Candidates from "./pages/Candidates";
import CandidateDetail from "./pages/CandidateDetail";
import History from "./pages/History";
import StockHistory from "./pages/StockHistory";
import PaperTrading from "./pages/PaperTrading";
import Settings from "./pages/Settings";
import Watchlist from "./pages/Watchlist";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/candidates/:symbol" element={<CandidateDetail />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:symbol" element={<StockHistory />} />
        <Route path="/paper-trading" element={<PaperTrading />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
