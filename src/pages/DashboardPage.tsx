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

  const statusColor = (status: string) =>
    status === "活跃" ? "bg-[#34c759]" : "bg-[#8e8e93]";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-[#1d1d1f]">对标管理</h1>
          <p className="mt-0.5 text-[12px] text-[#86868b]">管理你的对标公众号账号</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAccounts}
            className="rounded-md border border-[#d2d2d7] px-3 py-1.5 text-[12px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
          >
            刷新
          </button>
          <button className="rounded-md bg-[#1d1d1f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#3a3a3c] transition-colors">
            添加账号
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-[#fce4e4] bg-[#fef2f2] px-4 py-3 text-[12px] text-[#e5484d]">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="rounded-lg border border-[#e5e5ea] bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-[13px] text-[#aeaeb2]">加载中...</p>
          </div>
        ) : accounts.length === 0 && !error ? (
          <div className="py-24 text-center">
            <p className="text-[13px] text-[#aeaeb2]">暂无对标账号</p>
            <p className="mt-1 text-[12px] text-[#aeaeb2]">点击「添加账号」开始</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e5ea]">
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8e8e93] uppercase tracking-wide">名称</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8e8e93] uppercase tracking-wide">标识</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8e8e93] uppercase tracking-wide">赛道</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8e8e93] uppercase tracking-wide">状态</th>
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
                  <tr key={acc.id} className="border-b border-[#f5f5f7] hover:bg-[#fafafa] transition-colors">
                    <td className="px-5 py-2.5">
                      <span className="text-[13px] font-medium text-[#1d1d1f]">{name}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <code className="text-[11px] text-[#8e8e93]">{id.slice(0, 18)}...</code>
                    </td>
                    <td className="px-5 py-2.5">
                      {track && (
                        <span className="inline-flex rounded-full bg-[#e8e9fa] px-2 py-0.5 text-[11px] font-medium text-[#5e6ad2]">
                          {track}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-[#86868b]">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor(status)}`} />
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
