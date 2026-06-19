import { useEffect, useState, useCallback } from "react";
import {
  apiGetAccounts,
  apiGetStyles,
  apiDistill,
  apiGetLibrary,
  Account,
  StyleCard,
  FeishuRecord,
} from "../lib/api";

// ── 组件 ──────────────────────────────────

export default function DistillPage() {
  // 账号列表
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // 风格卡列表
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  // 文章（素材库）
  const [articles, setArticles] = useState<FeishuRecord[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(
    new Set()
  );

  // 蒸馏状态
  const [distilling, setDistilling] = useState(false);
  const [distillResult, setDistillResult] = useState<StyleCard | null>(null);
  const [error, setError] = useState("");

  // ── 加载 ──────────────────────────────

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiGetAccounts();
      setAccounts(data);
    } catch {
      // ignore
    }
  }, []);

  const loadStyles = useCallback(async () => {
    try {
      const data = await apiGetStyles();
      setStyles(data);
    } catch {
      // ignore
    } finally {
      setLoadingStyles(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadStyles();
  }, [loadAccounts, loadStyles]);

  // ── 选择账号 → 加载其文章 ─────────────

  const handleSelectAccount = async (acc: Account) => {
    setSelectedAccount(acc);
    setSelectedArticles(new Set());
    setDistillResult(null);
    setError("");

    setLoadingArticles(true);
    try {
      const all = await apiGetLibrary(200);
      const filtered = all.filter(
        (a) =>
          (a.fields["公众号名称"] as string) === acc.name ||
          (a.fields["source"] as string) === acc.name
      );
      setArticles(filtered);
    } catch {
      setArticles([]);
    } finally {
      setLoadingArticles(false);
    }
  };

  // ── 选择 / 取消文章 ───────────────────

  const toggleArticle = (id: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map((a) => a.id)));
    }
  };

  // ── 蒸馏 ──────────────────────────────

  const handleDistill = async () => {
    if (!selectedAccount) return;
    setDistilling(true);
    setError("");
    setDistillResult(null);
    try {
      const result = await apiDistill(selectedAccount.name);
      if (result.style) {
        setDistillResult(result.style);
        // 刷新风格列表
        loadStyles();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "蒸馏失败");
    } finally {
      setDistilling(false);
    }
  };

  // ── 渲染辅助 ───────────────────────────

  const getField = (fields: Record<string, unknown>, key: string, fallback = ""): string => {
    const val = fields[key];
    if (Array.isArray(val) && val.length > 0) return String(val[0]);
    if (val === null || val === undefined) return fallback;
    return String(val) !== "[object Object]" ? String(val) : fallback;
  };

  const selectedCount = selectedArticles.size;

  return (
    <div className="p-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">风格蒸馏</h1>
        <p className="mt-1 text-sm text-gray-500">
          选择对标账号和文章，AI 自动提炼写作风格
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：操作区 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 步骤 1: 选账号 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-gray-700">
              ① 选择对标账号
            </h2>
            <p className="mb-4 text-xs text-gray-400">
              从已关注的公众号中选择一个进行蒸馏
            </p>
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccount(acc)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    selectedAccount?.id === acc.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {acc.name}
                </button>
              ))}
              {accounts.length === 0 && (
                <p className="text-sm text-gray-400">
                  暂无对标账号，请先在「对标管理」中添加
                </p>
              )}
            </div>
          </div>

          {/* 步骤 2: 选文章 */}
          {selectedAccount && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">
                    ② 选择文章
                  </h2>
                  <p className="text-xs text-gray-400">
                    {selectedAccount.name} · {articles.length} 篇文章
                    {selectedCount > 0 && ` · 已选 ${selectedCount} 篇`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={toggleAll}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {selectedCount === articles.length ? "取消全选" : "全选"}
                  </button>
                </div>
              </div>

              {loadingArticles ? (
                <p className="text-sm text-gray-400 py-4">加载文章中...</p>
              ) : articles.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">
                  该账号暂无采集文章，请先在「一键采集」中同步
                </p>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {articles.map((art) => (
                    <label
                      key={art.id}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedArticles.has(art.id)}
                        onChange={() => toggleArticle(art.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {getField(art.fields, "文章标题", getField(art.fields, "title", "(无标题)"))}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {getField(art.fields, "source", "") || getField(art.fields, "公众号名称", "")}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* 蒸馏按钮 */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                <button
                  onClick={handleDistill}
                  disabled={distilling || !selectedAccount}
                  className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  {distilling ? "蒸馏中..." : "🎨 开始蒸馏"}
                </button>
              </div>
            </div>
          )}

          {/* 蒸馏结果 */}
          {distillResult && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
              <h2 className="mb-3 text-sm font-semibold text-purple-900">
                ✅ 蒸馏完成
              </h2>
              <div className="rounded-lg bg-white p-4">
                <p className="text-lg font-bold text-gray-900">
                  {distillResult.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  来源：{distillResult.source} · {distillResult.featureCount} 个特征
                </p>
                <ul className="mt-3 space-y-1">
                  {distillResult.features.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="text-purple-500 mt-0.5">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* 右侧：已有风格卡 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              已蒸馏风格 ({styles.length})
            </h3>
            {loadingStyles ? (
              <p className="text-sm text-gray-400">加载中...</p>
            ) : styles.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                暂无风格卡，选择账号开始蒸馏
              </p>
            ) : (
              <div className="space-y-3">
                {styles.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-gray-100 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        {s.name}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "ready"
                            ? "bg-green-50 text-green-600"
                            : "bg-yellow-50 text-yellow-600"
                        }`}
                      >
                        {s.status === "ready" ? "可用" : s.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.source} · {s.featureCount} 特征
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {s.features.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-xs text-gray-500">
                          · {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
