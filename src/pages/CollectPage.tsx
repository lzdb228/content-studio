import { useEffect, useState, useCallback } from "react";
import { apiGetAccounts, apiSyncAll, Account, SyncResult } from "../lib/api";

export default function CollectPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<SyncResult[]>([]);
  const [error, setError] = useState("");

  // 日期筛选
  const [beginDate, setBeginDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiGetAccounts();
      setAccounts(
        data.map((a) => ({ ...a, collectEnabled: a.status !== "停更" }))
      );
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    setResults([]);
    try {
      const data = await apiSyncAll(beginDate, endDate);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "采集失败");
    } finally {
      setSyncing(false);
    }
  };

  const totalNew = results.reduce((sum, r) => sum + (r.new_articles || 0), 0);
  const totalFiltered = results.reduce((sum, r) => sum + (r.filtered || 0), 0);
  const totalDeduped = results.reduce((sum, r) => sum + (r.deduped || 0), 0);
  const totalSkipped = results.filter((r) => r.note?.includes("跳过")).length;
  const totalFailed = results.filter((r) => !r.success).length;

  const activeCount = accounts.filter((a) => a.collectEnabled).length;
  const pausedCount = accounts.filter((a) => !a.collectEnabled).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">一键采集</h1>
        <p className="mt-1 text-sm text-gray-500">
          同步对标账号的最新文章到飞书素材库
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：采集面板 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 同步面板 */}
          <div className="rounded-xl border border-gray-200 bg-white p-8">
            {!syncing && results.length === 0 && (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
                  ⚡
                </div>
                <h2 className="mb-2 text-center text-lg font-semibold text-gray-900">
                  准备同步
                </h2>
                <p className="mb-6 text-center text-sm text-gray-500">
                  {activeCount} 个开启采集的账号，{pausedCount} 个已暂停
                </p>

                {/* 日期筛选 */}
                <div className="mb-6 flex items-center justify-center gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      起始日期
                    </label>
                    <input
                      type="date"
                      value={beginDate}
                      onChange={(e) => setBeginDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <span className="text-gray-300 pt-5">—</span>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      截止日期
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  {(beginDate || endDate) && (
                    <button
                      onClick={() => {
                        setBeginDate("");
                        setEndDate("");
                      }}
                      className="pt-5 text-xs text-gray-400 hover:text-gray-600"
                    >
                      清除
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <button
                    onClick={handleSync}
                    className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
                  >
                    开始同步
                  </button>
                </div>
              </>
            )}

            {syncing && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <p className="text-sm text-gray-500">
                  正在采集对标账号文章...
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* 结果汇总 */}
          {results.length > 0 && (
            <>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {results.length}
                  </p>
                  <p className="text-xs text-gray-500">已处理账号</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {totalNew}
                  </p>
                  <p className="text-xs text-gray-500">新增文章</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">
                    {totalDeduped}
                  </p>
                  <p className="text-xs text-gray-500">已去重</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-purple-500">
                    {totalFiltered}
                  </p>
                  <p className="text-xs text-gray-500">日期过滤</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-gray-400">
                    {totalSkipped}
                  </p>
                  <p className="text-xs text-gray-500">已跳过</p>
                </div>
                <div className={`rounded-xl border p-4 text-center ${totalFailed > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
                  <p className={`text-2xl font-bold ${totalFailed > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {totalFailed}
                  </p>
                  <p className="text-xs text-gray-500">失败</p>
                </div>
              </div>

              {/* 结果详情 */}
              <div className="rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        账号
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">
                        新增
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">
                        过滤
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">
                        去重
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        备注
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {r.account_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-semibold ${r.success ? "text-green-600" : "text-red-500"}`}
                          >
                            {r.new_articles ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-amber-600">
                          {r.filtered ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center text-purple-600">
                          {r.deduped ?? 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {r.note || r.error || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 重新同步按钮 */}
              <div className="text-center">
                <button
                  onClick={handleSync}
                  className="rounded-lg border border-gray-300 px-6 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  🔄 再次同步
                </button>
              </div>
            </>
          )}
        </div>

        {/* 右侧：账号状态 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              对标账号 ({accounts.length})
            </h3>
            {loadingAccounts ? (
              <p className="text-sm text-gray-400">加载中...</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {acc.name}
                      </p>
                      <p className="text-xs text-gray-400">{acc.track}</p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        acc.collectEnabled
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          acc.collectEnabled ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      {acc.collectEnabled ? "采集中" : "已暂停"}
                    </span>
                  </div>
                ))}
                {accounts.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">
                    暂无对标账号
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 提示 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs text-blue-700 leading-relaxed">
              💡 <strong>采集开关</strong>：在「对标管理」页面切换。
              关闭采集后，该账号将跳过自动同步。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
