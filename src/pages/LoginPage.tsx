import { useState, FormEvent } from "react";
import { apiLogin } from "../lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d]">
      <div className="w-[360px] rounded-xl border border-white/6 bg-[#1c1c1e] p-8">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#5e6ad2] text-xs font-bold text-white">
            CS
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white leading-tight">微信公众号内容工厂</h1>
            <p className="text-[11px] text-[#8a8a8e]">WeChat Content Factory</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="w-full rounded-md border border-white/10 bg-[#0d0d0d] px-3.5 py-2.5 text-[13px] text-white placeholder:text-[#5c5c5e] focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-[#0d0d0d] px-3.5 py-2.5 text-[13px] text-white placeholder:text-[#5c5c5e] focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20"
            />
          </div>
          {error && (
            <p className="text-center text-[12px] text-[#e5484d]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#5e6ad2] py-2.5 text-[13px] font-medium text-white hover:bg-[#6e7ae0] transition-colors disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
