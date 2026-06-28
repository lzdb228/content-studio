import { useEffect, useState } from "react";
import { apiGetRecords, FeishuRecord } from "../lib/api";

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<FeishuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    setError("");
    try {
      const records = await apiGetRecords("tbloLzUPoKoBOHti");
      setAccounts(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const getField = (fields: Record<string, unknown>, key: string, fallback = ""): string => {
    const val = fields[key];
    if (Array.isArray(val) && val.length > 0) return String(val[0]);
    return val ? String(val) : fallback;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-[#fafafa]">对标管理</h1>
          <p className="mt-0.5 text-[12px] text-[#8a8a8e]">管理你的对标公众号账号</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAccounts}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[#8a8a8e] hover:bg-white/5 hover:text-white transition-colors"
          >
            刷新
          </button>
          <button className="rounded-md bg-[#5e6ad2] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#6e7ae0] transition-colors">
            添加账号
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-4 py-3 text-[12px] text-[#e5484d]">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="rounded-lg border border-white/6 bg-[#1c1c1e]">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-[13px] text-[#5c5c5e]">加载中...</p>
          </div>
        ) : accounts.length === 0 && !error ? (
          <div className="py-24 text-center">
            <p className="text-[13px] text-[#8a8a8e]">暂无对标账号</p>
            <p className="mt-1 text-[12px] text-[#5c5c5e]">点击「添加账号」开始</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/6">
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">名称</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">标识</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">赛道</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">状态</th>
                <th className="px-5 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => {
                const name = getField(acc.fields, "公众号名称");
                const id = getField(acc.fields, "账号标识");
                const track = getField(acc.fields, "赛道");
                const status = getField(acc.fields, "状态", "未知");
                return (
                  <tr key={acc.id} className="border-b border-white/4 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="text-[13px] font-medium text-[#fafafa]">{name}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <code className="text-[11px] text-[#5c5c5e]">{id.slice(0, 18)}...</code>
                    </td>
                    <td className="px-5 py-2.5">
                      {track && (
                        <span className="inline-flex rounded-full bg-[#5e6ad2]/15 px-2 py-0.5 text-[11px] font-medium text-[#5e6ad2]">
                          {track}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-[#8a8a8e]">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${status === "活跃" ? "bg-[#34c759]" : "bg-[#5c5c5e]"}`} />
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <button className="text-[12px] text-[#5e6ad2] hover:text-[#7b85e8] transition-colors">
                        编辑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
