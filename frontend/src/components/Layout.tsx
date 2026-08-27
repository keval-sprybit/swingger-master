import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Upload, List, Eye, Clock, BookOpen, ArrowRightLeft, Settings, BarChart3,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload CSV", icon: Upload },
  { to: "/candidates", label: "Candidates", icon: List },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
  { to: "/history", label: "History", icon: Clock },
  { to: "/paper-trading", label: "Paper Trading", icon: ArrowRightLeft },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
            <BarChart3 size={22} />
            <span>NSE Swing Analyzer</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Local Analysis Tool</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <p className="text-[9px] text-gray-600 leading-tight">
            Analytical decision-support tool. Market returns not guaranteed. High score ≠ profit.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
