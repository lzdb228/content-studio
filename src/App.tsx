import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "./stores";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import CollectPage from "./pages/CollectPage";
import LibraryPage from "./pages/LibraryPage";
import DistillPage from "./pages/DistillPage";
import CreatePage from "./pages/CreatePage";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "□", label: "对标管理" },
  { to: "/collect",   icon: "⇣", label: "一键采集" },
  { to: "/distill",   icon: "◆", label: "风格蒸馏" },
  { to: "/create",    icon: "✎", label: "创作工坊" },
  { to: "/library",   icon: "☰", label: "素材库" },
  { to: "/settings",  icon: "⚙", label: "设置"     },
];

function Sidebar() {
  const navigate = useNavigate();
  const { username, logout } = useAuthStore();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
      isActive
        ? "bg-white/8 text-white"
        : "text-[#8a8a8e] hover:bg-white/5 hover:text-[#d4d4d8]"
    }`;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex h-screen w-[200px] flex-col bg-[#161616] select-none">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/6">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-[#5e6ad2] text-[11px] font-semibold text-white">
          CS
        </div>
        <span className="text-[13px] font-medium text-[#d4d4d8]">公众号工厂</span>
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
      <div className="border-t border-white/6 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-medium text-[#d4d4d8]">
            {username?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="flex-1 truncate text-[12px] text-[#8a8a8e]">{username}</span>
          <button
            onClick={handleLogout}
            className="text-[11px] text-[#8a8a8e] hover:text-white transition-colors"
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
    <div className="flex h-screen bg-[#0d0d0d] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/collect" element={<CollectPage />} />
          <Route path="/distill" element={<DistillPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
