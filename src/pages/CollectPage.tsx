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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[15px] font-semibold text-[#1d1d1f]">一键采集</h1>
        <p className="mt-0.5 text-[12px] text-[#86868b]">同步对标账号的最新文章到飞书素材库</p>
      </div>

      {/* initial / results-empty state — compact card */}
      {!syncing && results.length === 0 && (
        <div className="rounded-lg border border-[#e5e5ea] bg-white p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f5f7] text-2xl">
            ⇣
          </div>
          <h2 className="mb-1 text-[14px] font-medium text-[#1d1d1f]">准备同步对标账号</h2>
          <p className="mb-5 text-[12px] text-[#86868b]">
            将采集所有对标公众号的最新文章，写入飞书内容工厂
          </p>
          <button
            onClick={handleSync}
            className="rounded-md bg-[#1d1d1f] px-6 py-2 text-[13px] font-medium text-white hover:bg-[#3a3a3c] transition-colors"
          >
            开始同步
          </button>
        </div>
      )}

      {/* syncing */}
      {syncing && (
        <div className="rounded-lg border border-[#e5e5ea] bg-white py-12 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#5e6ad2]" />
          <p className="text-[13px] text-[#86868b]">正在采集对标账号文章...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-[#fce4e4] bg-[#fef2f2] px-4 py-3 text-[12px] text-[#e5484d]">
          {error}
        </div>
      )}

      {/* results */}
      {results.length > 0 && (
        <>
          {/* Stats bar */}
          <div className="mb-4 grid grid-cols-4 gap-3">
            {[
              { label: "已处理", value: results.length, color: "text-[#1d1d1f]" },
              { label: "新增", value: totalNew, color: "text-[#34c759]" },
              { label: "更新", value: totalUpdated, color: "text-[#5e6ad2]" },
              { label: "失败", value: failedCount, color: "text-[#e5484d]" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-[#e5e5ea] bg-white px-4 py-3">
                <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-[11px] text-[#8e8e93]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div className="rounded-lg border border-[#e5e5ea] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e5ea]">
                  <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8e8e93] uppercase">账号</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[#8e8e93] uppercase">状态</th>
                  <th className="px-5 py-2.5 text-center text-[11px] font-medium text-[#8e8e93] uppercase">新增</th>
                  <th className="px-5 py-2.5 text-center text-[11px] font-medium text-[#8e8e93] uppercase">更新</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-[#f5f5f7]">
                    <td className="px-5 py-2.5 text-[13px] font-medium text-[#1d1d1f]">{r.account_name}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[12px] ${r.success ? "text-[#34c759]" : "text-[#e5484d]"}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${r.success ? "bg-[#34c759]" : "bg-[#e5484d]"}`} />
                        {r.success ? "成功" : "失败"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-center text-[13px] text-[#34c759]">{r.new_articles}</td>
                    <td className="px-5 py-2.5 text-center text-[13px] text-[#5e6ad2]">{r.updated_articles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={handleSync}
              className="rounded-md border border-[#d2d2d7] px-4 py-1.5 text-[12px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              再次同步
            </button>
          </div>
        </>
      )}
    </div>
  );
}
