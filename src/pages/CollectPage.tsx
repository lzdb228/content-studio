import { useState } from "react";
import { apiSyncAll, CollectResult } from "../lib/api";

export default function CollectPage() {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<CollectResult[]>([]);
  const [error, setError] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    setResults([]);
    try {
      const data = await apiSyncAll();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "采集失败");
    } finally {
      setSyncing(false);
    }
  };

  const totalNew = results.reduce((sum, r) => sum + r.new_articles, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated_articles, 0);
  const failedCount = results.filter((r) => !r.success).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">一键采集</h1>
        <p className="mt-1 text-sm text-gray-500">同步对标账号的最新文章到飞书素材库</p>
      </div>

      {/* Sync Panel */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-8 text-center">
        {!syncing && results.length === 0 && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
              ⚡
            </div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">准备同步对标账号</h2>
            <p className="mb-6 text-sm text-gray-500">
              将采集所有对标公众号的最新文章，写入飞书内容工厂
            </p>
            <button
              onClick={handleSync}
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              开始同步
            </button>
          </>
        )}

        {syncing && (
          <div className="py-8">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm text-gray-500">正在采集对标账号文章...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{results.length}</p>
              <p className="text-xs text-gray-500">已处理账号</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{totalNew}</p>
              <p className="text-xs text-gray-500">新增文章</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{totalUpdated}</p>
              <p className="text-xs text-gray-500">更新文章</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">账号</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">状态</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">新增</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">更新</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 font-medium text-gray-900">{r.account_name}</td>
                    <td className="px-6 py-4">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          ✅ 成功
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600" title={r.error}>
                          ❌ 失败
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-green-600">{r.new_articles}</td>
                    <td className="px-6 py-4 text-center text-blue-600">{r.updated_articles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={handleSync}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              🔄 再次同步
            </button>
          </div>
        </>
      )}
    </div>
  );
}
