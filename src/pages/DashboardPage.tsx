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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">对标管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理你的对标公众号账号</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadAccounts}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            🔄 刷新
          </button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
            + 添加账号
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
          <p className="text-gray-400">加载中...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500">公众号名称</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">账号标识</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">赛道</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">状态</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {getField(acc.fields, "公众号名称")}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {getField(acc.fields, "账号标识").slice(0, 20)}...
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {getField(acc.fields, "赛道")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs ${getField(acc.fields, "状态") === "活跃" ? "text-green-600" : "text-gray-400"}`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${getField(acc.fields, "状态") === "活跃" ? "bg-green-500" : "bg-gray-300"}`} />
                      {getField(acc.fields, "状态", "未知")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs text-blue-600 hover:text-blue-800 transition">编辑</button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    暂无对标账号，点击「添加账号」开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
