import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "./stores";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import CollectPage from "./pages/CollectPage";
import LibraryPage from "./pages/LibraryPage";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "□", label: "对标管理" },
  { to: "/collect",   icon: "⇣", label: "一键采集" },
  { to: "/library",   icon: "☰", label: "素材库" },
  { to: "/settings",  icon: "⚙", label: "设置"     },
];

function Sidebar() {
  const navigate = useNavigate();
  const { username, logout } = useAuthStore();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
      isActive
        ? "bg-[#2c2c2e] text-white"
        : "text-[#86868b] hover:bg-[#2c2c2e] hover:text-[#d1d1d6]"
    }`;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex h-screen w-[200px] flex-col bg-[#1c1c1e] select-none">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#2c2c2e]">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-[#5e6ad2] text-[11px] font-semibold text-white">
          CS
        </div>
        <span className="text-[13px] font-medium text-[#d1d1d6]">内容工坊</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2.5 py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <span className="w-4 text-center text-xs opacity-60">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-[#2c2c2e] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3a3a3c] text-[10px] font-medium text-[#d1d1d6]">
            {username?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="flex-1 truncate text-[12px] text-[#86868b]">{username}</span>
          <button
            onClick={handleLogout}
            className="text-[11px] text-[#5e6ad2] hover:text-[#7b85e8] transition-colors"
          >
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const { isLoggedIn } = useAuthStore();

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-[#f5f5f7] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/collect" element={<CollectPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
