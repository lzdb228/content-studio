import { useEffect, useState, useCallback } from "react";
import {
  apiGetStyles,
  apiDistill,
  apiSearchAccounts,
  apiFetchArticles,
  StyleCard,
  WxAccountSearchResult,
  WxArticle,
} from "../lib/api";

export default function DistillPage() {
  // 风格卡列表
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WxAccountSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 选中的账号 + 文章
  const [selectedAccount, setSelectedAccount] = useState<WxAccountSearchResult | null>(null);
  const [articles, setArticles] = useState<WxArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<number>>(new Set());

  // 展开的文章
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);

  // 蒸馏状态
  const [distilling, setDistilling] = useState(false);
  const [distillResult, setDistillResult] = useState<StyleCard | null>(null);
  const [error, setError] = useState("");

  // ── 加载风格卡 ─────────────────────────

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
    loadStyles();
  }, [loadStyles]);

  // ── 搜索公众号 ────────────────────────

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const results = await apiSearchAccounts(q.trim(), 1, 10);
      setSearchResults(results);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  // ── 选择账号 → 拉取文章 ───────────────

  const handleSelectAccount = async (item: WxAccountSearchResult) => {
    setSelectedAccount(item);
    setArticles([]);
    setSelectedArticles(new Set());
    setExpandedArticle(null);
    setDistillResult(null);
    setError("");
    setShowDropdown(false);
    setSearchQuery(item.nickname);

    setLoadingArticles(true);
    try {
      const data = await apiFetchArticles(item.fakeid, 10);
      setArticles(data);
    } catch {
      setError("获取文章失败，请确认 wechat_crawl 已认证");
      setArticles([]);
    } finally {
      setLoadingArticles(false);
    }
  };

  // ── 多选文章 ──────────────────────────

  const toggleArticle = (idx: number) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map((_, i) => i)));
    }
  };

  // ── 展开文章内容 ──────────────────────

  const toggleExpand = (idx: number) => {
    setExpandedArticle((prev) => (prev === idx ? null : idx));
  };

  // ── 蒸馏 ──────────────────────────────

  const handleDistill = async () => {
    if (!selectedAccount || selectedArticles.size === 0) return;
    setDistilling(true);
    setError("");
    setDistillResult(null);

    try {
      const selectedTexts = Array.from(selectedArticles)
        .sort((a, b) => a - b)
        .map((idx) => articles[idx]?.digest || "")
        .filter(Boolean);

      const result = await apiDistill(
        selectedAccount.nickname,
        selectedTexts
      );
      if (result.style) {
        setDistillResult(result.style);
        // 刷新风格卡列表
        loadStyles();
      } else {
        setError(result.message || "蒸馏未返回结果");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "蒸馏失败");
    } finally {
      setDistilling(false);
    }
  };

  // ── 渲染 ──────────────────────────────

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">风格蒸馏</h1>
        <p className="mt-1 text-sm text-gray-500">
          搜索公众号 → 拉取最新文章 → 选择蒸馏 → AI 提取写作风格
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：蒸馏操作 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 搜索栏 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">搜索公众号</h2>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="搜索微信公众号名称，如「AI」「产品」..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  搜索中...
                </span>
              )}
              {/* 搜索下拉 */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {searchResults.map((item) => (
                    <div
                      key={item.fakeid}
                      onClick={() => handleSelectAccount(item)}
                      className="cursor-pointer px-4 py-3 hover:bg-blue-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.nickname}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.signature || "暂无简介"}
                        </p>
                      </div>
                      <span className="ml-3 shrink-0 text-xs text-blue-500">
                        {selectedAccount?.fakeid === item.fakeid ? "✓ 已选" : "选择 →"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {showDropdown && searchQuery.trim() && !searching && searchResults.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-4 text-sm text-gray-400 text-center">
                  未找到匹配的公众号
                </div>
              )}
            </div>
          </div>

          {/* 文章列表 */}
          {selectedAccount && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedAccount.nickname}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {articles.length > 0
                      ? `最近 ${articles.length} 篇文章（已选 ${selectedArticles.size} 篇）`
                      : loadingArticles
                      ? "加载中..."
                      : "暂无文章"}
                  </p>
                </div>
                {articles.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {selectedArticles.size === articles.length ? "取消全选" : "全选"}
                  </button>
                )}
              </div>

              {loadingArticles ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  正在拉取文章...
                </div>
              ) : articles.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  该账号暂无文章数据
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {articles.map((art, idx) => {
                    const isSelected = selectedArticles.has(idx);
                    const isExpanded = expandedArticle === idx;
                    return (
                      <div key={idx}>
                        <div
                          className={`flex items-start gap-3 px-6 py-4 cursor-pointer transition ${
                            isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleArticle(idx)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div
                            className="flex-1 min-w-0"
                            onClick={() => toggleExpand(idx)}
                          >
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {art.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {art.create_time?.slice(0, 10) || "未知日期"}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(idx);
                            }}
                            className="shrink-0 text-xs text-gray-400 hover:text-blue-600 transition mt-1"
                          >
                            {isExpanded ? "收起 ▲" : "展开 ▼"}
                          </button>
                        </div>
                        {/* 展开内容 */}
                        {isExpanded && (
                          <div className="px-14 pb-4">
                            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                              {art.digest || "(无摘要内容)"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 蒸馏按钮 */}
              {articles.length > 0 && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <button
                    onClick={handleDistill}
                    disabled={selectedArticles.size === 0 || distilling}
                    className="w-full rounded-lg bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {distilling ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        正在 AI 分析风格...
                      </>
                    ) : (
                      `🔬 蒸馏已选的 ${selectedArticles.size} 篇文章`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {!selectedAccount && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
              <div className="mx-auto mb-3 text-4xl">🔍</div>
              <p className="text-gray-500">搜索公众号开始蒸馏</p>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 蒸馏结果 */}
          {distillResult && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-purple-900">
                ✅ {distillResult.name} 风格特征
              </h3>
              <div className="space-y-2">
                {distillResult.features?.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-white px-4 py-2.5 shadow-sm"
                  >
                    <span className="mt-0.5 text-sm text-purple-500">•</span>
                    <span className="text-sm text-gray-700">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：已有风格卡 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              已有风格卡
            </h3>
            {loadingStyles ? (
              <p className="text-sm text-gray-400">加载中...</p>
            ) : styles.length === 0 ? (
              <p className="text-sm text-gray-400">暂无风格卡</p>
            ) : (
              <div className="space-y-3">
                {styles.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900">{s.name}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "ready"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {s.status === "ready" ? "就绪" : "蒸馏中"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {s.featureCount} 特征 · {s.source}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.features?.slice(0, 3).map((f, i) => (
                        <span
                          key={i}
                          className="rounded bg-white px-2 py-0.5 text-xs text-gray-500 shadow-sm"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
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
