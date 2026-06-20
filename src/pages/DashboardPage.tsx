import { useEffect, useState, useCallback } from "react";
import {
  apiGetAccounts,
  apiCreateAccount,
  apiDeleteAccount,
  apiSearchAccounts,
  apiUpdateAccountStatus,
  Account,
  WxAccountSearchResult,
} from "../lib/api";

// ── 组件 ──────────────────────────────────

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WxAccountSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // 添加中
  const [addingId, setAddingId] = useState<string | null>(null);

  // ── 加载对标账号 ──────────────────────

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGetAccounts();
      // 从服务端状态派生 collectEnabled
      const withToggle = data.map((a) => ({
        ...a,
        collectEnabled: a.status === "活跃",
      }));
      setAccounts(withToggle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ── 搜索公众号 ────────────────────────

  const doSearch = useCallback(async (q: string, page = 1) => {
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearchPage(1);
      setHasMore(false);
      return;
    }
    setSearching(true);
    try {
      const results = await apiSearchAccounts(q.trim(), page);
      if (page === 1) {
        setSearchResults(results);
      } else {
        setSearchResults((prev) => [...prev, ...results]);
      }
      setSearchPage(page);
      setHasMore(results.length === 5); // 微信接口每页5条，满5条表示可能还有更多
      setShowDropdown(true);
    } catch {
      if (page === 1) setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // 防抖搜索（搜索词变化时从第1页开始）
  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery, 1), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  // ── 添加账号 ──────────────────────────

  const handleAdd = async (item: WxAccountSearchResult) => {
    setAddingId(item.fakeid);
    try {
      const created = await apiCreateAccount({
        name: item.nickname,
        identifier: item.fakeid,
        track: serviceTypeLabel(item.service_type),
        status: "活跃",
      });
      setAccounts((prev) => [...prev, { ...created, collectEnabled: true }]);
      // 从搜索结果移除
      setSearchResults((prev) => prev.filter((r) => r.fakeid !== item.fakeid));
    } catch (err) {
      alert(err instanceof Error ? err.message : "添加失败");
    } finally {
      setAddingId(null);
    }
  };

  // ── 删除 ──────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDeleteAccount(deleteTarget.id);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  // ── 采集开关 ──────────────────────────

  const toggleCollect = async (acc: Account) => {
    const newStatus = acc.collectEnabled ? "停更" : "活跃";
    // 乐观更新
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === acc.id
          ? { ...a, collectEnabled: !a.collectEnabled, status: newStatus }
          : a
      )
    );
    try {
      await apiUpdateAccountStatus(acc.id, newStatus);
    } catch {
      // 回滚
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === acc.id
            ? { ...a, collectEnabled: acc.collectEnabled, status: acc.status }
            : a
        )
      );
    }
  };

  // ── 渲染 ──────────────────────────────

  return (
    <div className="p-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">对标管理</h1>
        <p className="mt-1 text-sm text-gray-500">搜索并关注对标公众号，管理采集开关</p>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-lg">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="搜索微信公众号名称，如「AI」「副业」..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                搜索中...
              </span>
            )}
          </div>
          <button
            onClick={loadAccounts}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            🔄 刷新
          </button>
        </div>

        {/* 搜索下拉 */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-lg">
            {searchResults.map((item) => (
              <div
                key={item.fakeid}
                className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.nickname}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {item.signature || "暂无简介"}
                  </p>
                </div>
                <button
                  onClick={() => handleAdd(item)}
                  disabled={addingId === item.fakeid}
                  className="ml-3 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {addingId === item.fakeid ? "添加中..." : "+ 添加关注"}
                </button>
              </div>
            ))}
            {/* 分页：加载更多 */}
            {hasMore && (
              <button
                onClick={() => doSearch(searchQuery, searchPage + 1)}
                disabled={searching}
                className="w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition border-t border-gray-100 flex items-center justify-center gap-1"
              >
                {searching ? "加载中..." : `加载更多（第 ${searchPage + 1} 页）`}
              </button>
            )}
          </div>
        )}
        {showDropdown && searchQuery.trim() && !searching && searchResults.length === 0 && (
          <div className="absolute z-50 mt-1 w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-4 text-sm text-gray-400 text-center">
            未找到匹配的公众号
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 账号表格 */}
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
                <th className="px-6 py-3 text-left font-medium text-gray-500">赛道</th>
                <th className="px-6 py-3 text-center font-medium text-gray-500">自动采集</th>
                <th className="px-6 py-3 text-center font-medium text-gray-500">状态</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{acc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      {acc.identifier?.slice(0, 24)}...
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {acc.track}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleCollect(acc)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        acc.collectEnabled ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          acc.collectEnabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        acc.status === "活跃" ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          acc.status === "活跃" ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      {acc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setDeleteTarget(acc)}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline transition"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    暂无对标账号，在上方搜索框搜索并添加公众号
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="w-96 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
            <p className="mt-2 text-sm text-gray-600">
              确定要移除对标账号「<strong>{deleteTarget.name}</strong>」吗？已采集的文章将保留。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 工具函数 ─────────────────────────────

function serviceTypeLabel(t: number): string {
  switch (t) {
    case 0:
      return "订阅号";
    case 1:
      return "订阅号(旧)";
    case 2:
      return "服务号";
    default:
      return "公众号";
  }
}
