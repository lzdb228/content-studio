import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "./stores";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import CollectPage from "./pages/CollectPage";
import LibraryPage from "./pages/LibraryPage";

function Sidebar() {
  const navigate = useNavigate();
  const { username, logout } = useAuthStore();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
      isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
    }`;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          工
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">内容工坊</p>
          <p className="text-xs text-gray-400">{username}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavLink to="/dashboard" className={linkClass}>
          📋 对标管理
        </NavLink>
        <NavLink to="/collect" className={linkClass}>
          ⚡ 一键采集
        </NavLink>
        <NavLink to="/library" className={linkClass}>
          📚 素材库
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          ⚙️ 设置
        </NavLink>
      </nav>

      <div className="border-t border-gray-100 px-3 py-4">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-100 transition"
        >
          退出登录
        </button>
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
    <div className="flex min-h-screen bg-gray-50">
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
