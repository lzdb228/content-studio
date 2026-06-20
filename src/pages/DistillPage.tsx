import { useEffect, useState, useCallback } from "react";
import {
  apiGetStyles,
  apiDistill,
  apiAddStyle,
  apiSearchAccounts,
  apiFetchArticles,
  StyleCard,
  WxAccountSearchResult,
  WxArticle,
} from "../lib/api";

// ── 向导步骤定义 ──────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepDef {
  num: WizardStep;
  label: string;
  desc: string;
}

const STEPS: StepDef[] = [
  { num: 1, label: "搜索选择", desc: "搜索并选择公众号" },
  { num: 2, label: "文章选择", desc: "勾选要分析的文章" },
  { num: 3, label: "内容预览", desc: "预览选中文章内容" },
  { num: 4, label: "风格分析", desc: "AI 提取写作风格" },
  { num: 5, label: "保存入库", desc: "保存风格到素材库" },
];

// ── 批量蒸馏状态 ──────────────────────────────

interface BatchProgress {
  accountName: string;
  status: "pending" | "running" | "done" | "error";
  result?: StyleCard;
  error?: string;
}

export default function DistillPage() {
  // ── 向导状态 ─────────────────────────
  const [step, setStep] = useState<WizardStep>(1);

  // 风格卡列表
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  // 批量模式
  const [batchMode, setBatchMode] = useState(false);
  const [batchAccounts, setBatchAccounts] = useState<WxAccountSearchResult[]>([]);
  const [batchArticles, setBatchArticles] = useState<Record<string, WxArticle[]>>({});
  const [batchProgress, setBatchProgress] = useState<BatchProgress[]>([]);

  // ── Step 1: 搜索 ─────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WxAccountSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WxAccountSearchResult | null>(null);

  // ── Step 2: 文章选择 ────────────────
  const [articles, setArticles] = useState<WxArticle[]>([]);
  const [_loadingArticles, setLoadingArticles] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<number>>(new Set());

  // ── Step 3: 预览 ────────────────────

  // ── Step 4: 蒸馏 ────────────────────
  const [distilling, setDistilling] = useState(false);
  const [distillResult, setDistillResult] = useState<StyleCard | null>(null);
  const [distillError, setDistillError] = useState("");

  // ── Step 5: 保存 ────────────────────
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [saveError, setSaveError] = useState("");

  // ── 错误 ────────────────────────────
  const [error, setError] = useState("");

  // ── 加载风格卡 ──────────────────────

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

  // ── Step 1: 搜索公众号 ──────────────

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

  const handleSelectAccount = async (item: WxAccountSearchResult) => {
    if (batchMode) {
      // 批量模式：加入/移出账号列表
      setBatchAccounts((prev) => {
        const exists = prev.find((a) => a.fakeid === item.fakeid);
        if (exists) return prev.filter((a) => a.fakeid !== item.fakeid);
        return [...prev, item];
      });
      setSearchQuery("");
      setShowDropdown(false);
      return;
    }

    // 单选模式
    setSelectedAccount(item);
    setArticles([]);
    setSelectedArticles(new Set());
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

  // ── 批量：拉取所有账号文章 ──────────

  const fetchBatchArticles = async () => {
    setLoadingArticles(true);
    const allArticles: Record<string, WxArticle[]> = {};
    for (const acc of batchAccounts) {
      try {
        allArticles[acc.fakeid] = await apiFetchArticles(acc.fakeid, 10);
      } catch {
        allArticles[acc.fakeid] = [];
      }
    }
    setBatchArticles(allArticles);
    setLoadingArticles(false);
  };

  // ── 批量：选择账号文章 ──────────────

  const [batchSelected, setBatchSelected] = useState<Record<string, Set<number>>>({});

  const toggleBatchArticle = (fakeid: string, idx: number) => {
    setBatchSelected((prev) => {
      const next = { ...prev };
      if (!next[fakeid]) next[fakeid] = new Set();
      else next[fakeid] = new Set(next[fakeid]);
      if (next[fakeid].has(idx)) next[fakeid].delete(idx);
      else next[fakeid].add(idx);
      return next;
    });
  };

  const toggleBatchAll = (fakeid: string, total: number) => {
    setBatchSelected((prev) => {
      const next = { ...prev };
      const cur = next[fakeid] ? new Set(next[fakeid]) : new Set();
      if (cur.size === total) {
        next[fakeid] = new Set();
      } else {
        next[fakeid] = new Set(Array.from({ length: total }, (_, i) => i));
      }
      return next;
    });
  };

  // ── 多选文章（单选模式）─────────────

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

  // ── 向导导航 ────────────────────────

  const canGoStep2 = () => {
    if (batchMode) return batchAccounts.length > 0;
    return !!selectedAccount && articles.length > 0;
  };

  const canGoStep3 = () => {
    if (batchMode) {
      return Object.values(batchSelected).some((s) => s.size > 0);
    }
    return selectedArticles.size > 0;
  };

  const goNext = () => {
    if (step === 1) {
      if (batchMode && batchAccounts.length > 0) {
        fetchBatchArticles();
      }
    }
    if (step < 5) setStep((s) => (s + 1) as WizardStep);
  };

  const goPrev = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  // ── Step 4: 蒸馏 ────────────────────

  const handleDistill = async () => {
    setDistilling(true);
    setDistillError("");
    setDistillResult(null);

    if (batchMode) {
      // 批量蒸馏
      const progress: BatchProgress[] = batchAccounts.map((acc) => ({
        accountName: acc.nickname,
        status: "pending" as const,
      }));
      setBatchProgress(progress);

      for (let i = 0; i < batchAccounts.length; i++) {
        const acc = batchAccounts[i];
        const selected = batchSelected[acc.fakeid] || new Set();
        const arts = batchArticles[acc.fakeid] || [];
        const texts = Array.from(selected)
          .sort((a, b) => a - b)
          .map((idx) => arts[idx]?.digest || "")
          .filter(Boolean);

        if (texts.length === 0) {
          setBatchProgress((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: "error", error: "未选择文章" };
            return next;
          });
          continue;
        }

        setBatchProgress((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "running" };
          return next;
        });

        try {
          const result = await apiDistill(acc.nickname, texts);
          if (result.style) {
            setBatchProgress((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], status: "done", result: result.style };
              return next;
            });
          } else {
            setBatchProgress((prev) => {
              const next = [...prev];
              next[i] = {
                ...next[i],
                status: "error",
                error: result.message || "蒸馏未返回结果",
              };
              return next;
            });
          }
        } catch (err) {
          setBatchProgress((prev) => {
            const next = [...prev];
            next[i] = {
              ...next[i],
              status: "error",
              error: err instanceof Error ? err.message : "蒸馏失败",
            };
            return next;
          });
        }
      }
    } else {
      // 单选蒸馏
      if (!selectedAccount || selectedArticles.size === 0) return;
      try {
        const selectedTexts = Array.from(selectedArticles)
          .sort((a, b) => a - b)
          .map((idx) => articles[idx]?.digest || "")
          .filter(Boolean);

        const result = await apiDistill(selectedAccount.nickname, selectedTexts);
        if (result.style) {
          setDistillResult(result.style);
          loadStyles();
        } else {
          setDistillError(result.message || "蒸馏未返回结果");
        }
      } catch (err) {
        setDistillError(err instanceof Error ? err.message : "蒸馏失败");
      }
    }
    setDistilling(false);
  };

  // ── Step 5: 保存风格入库 ────────────

  const handleSave = async (card: StyleCard) => {
    setSaving(true);
    setSaveError("");
    try {
      await apiAddStyle({
        name: card.name,
        source: card.source,
        features: card.features,
      });
      setSavedName(card.name);
      loadStyles();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // ── 批量保存 ────────────────────────

  const handleBatchSave = async () => {
    setSaving(true);
    setSaveError("");
    let saved = 0;
    let failed = 0;
    for (const p of batchProgress) {
      if (p.status === "done" && p.result) {
        try {
          await apiAddStyle({
            name: p.result.name,
            source: p.result.source,
            features: p.result.features,
          });
          saved++;
        } catch {
          failed++;
        }
      }
    }
    setSaving(false);
    if (saved > 0) {
      setSavedName(`${saved} 个风格已保存${failed > 0 ? `，${failed} 个失败` : ""}`);
      loadStyles();
    } else {
      setSaveError("没有可保存的风格");
    }
  };

  // ── 重置向导 ────────────────────────

  const resetWizard = () => {
    setStep(1);
    setSelectedAccount(null);
    setArticles([]);
    setSelectedArticles(new Set());
    setDistillResult(null);
    setDistillError("");
    setSavedName("");
    setSaveError("");
    setError("");
    setSearchQuery("");
    setSearchResults([]);
    setBatchAccounts([]);
    setBatchArticles({});
    setBatchSelected({});
    setBatchProgress([]);
  };

  // ── 渲染辅助 ────────────────────────

  const totalSteps = STEPS.length;

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const isActive = step === s.num;
          const isCompleted = step > s.num;
          return (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    isCompleted
                      ? "bg-purple-600 text-white"
                      : isActive
                      ? "bg-purple-100 text-purple-700 ring-2 ring-purple-400"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isCompleted ? "✓" : s.num}
                </div>
                <p
                  className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                    isActive ? "text-purple-700" : isCompleted ? "text-purple-600" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </p>
              </div>
              {i < totalSteps - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-16px]">
                  <div
                    className={`h-full rounded transition ${
                      isCompleted ? "bg-purple-600" : "bg-gray-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 渲染 Step 1: 搜索选择 ───────────

  const renderStep1 = () => (
    <div className="space-y-4">
      {/* 批量模式开关 */}
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={batchMode}
            onChange={(e) => {
              setBatchMode(e.target.checked);
              setBatchAccounts([]);
              setSelectedAccount(null);
              setArticles([]);
              setBatchArticles({});
              setBatchSelected({});
              setSearchQuery("");
            }}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-600">批量蒸馏模式</span>
        </label>
        {batchMode && (
          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
            已选 {batchAccounts.length} 个账号
          </span>
        )}
      </div>

      {/* 搜索框 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {batchMode ? "添加公众号（可多选）" : "搜索公众号"}
        </h2>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="搜索微信公众号名称，如「AI」「产品」..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              搜索中...
            </span>
          )}
          {/* 搜索下拉 */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {searchResults.map((item) => {
                const isSelected = batchMode
                  ? batchAccounts.some((a) => a.fakeid === item.fakeid)
                  : selectedAccount?.fakeid === item.fakeid;
                return (
                  <div
                    key={item.fakeid}
                    onClick={() => handleSelectAccount(item)}
                    className={`cursor-pointer px-4 py-3 hover:bg-purple-50 transition flex items-center justify-between ${
                      isSelected ? "bg-purple-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.nickname}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {item.signature || "暂无简介"}
                      </p>
                    </div>
                    <span
                      className={`ml-3 shrink-0 text-xs ${
                        isSelected ? "text-purple-700 font-medium" : "text-purple-500"
                      }`}
                    >
                      {isSelected ? "✓ 已选" : "选择 →"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {showDropdown && searchQuery.trim() && !searching && searchResults.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-4 text-sm text-gray-400 text-center">
              未找到匹配的公众号
            </div>
          )}
        </div>

        {/* 批量已选列表 */}
        {batchMode && batchAccounts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-500 font-medium">已选账号：</p>
            {batchAccounts.map((acc) => (
              <div
                key={acc.fakeid}
                className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2"
              >
                <span className="text-sm text-gray-900">{acc.nickname}</span>
                <button
                  onClick={() =>
                    setBatchAccounts((prev) => prev.filter((a) => a.fakeid !== acc.fakeid))
                  }
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 单选：已选账号提示 */}
      {!batchMode && selectedAccount && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-purple-900">{selectedAccount.nickname}</span>
            <span className="ml-2 text-xs text-purple-500">
              {articles.length > 0 ? `${articles.length} 篇文章已就绪` : "加载中..."}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
              已选择
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // ── 渲染 Step 2: 文章选择 ───────────

  const renderStep2 = () => {
    if (batchMode) {
      // 批量模式：每账号展示文章列表
      return (
        <div className="space-y-6">
          {batchAccounts.map((acc) => {
            const arts = batchArticles[acc.fakeid] || [];
            const selected = batchSelected[acc.fakeid] || new Set();
            return (
              <div key={acc.fakeid} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
                  <h3 className="font-semibold text-gray-900 text-sm">{acc.nickname}</h3>
                  {arts.length > 0 && (
                    <button
                      onClick={() => toggleBatchAll(acc.fakeid, arts.length)}
                      className="text-xs text-purple-600 hover:text-purple-800"
                    >
                      {selected.size === arts.length ? "取消全选" : "全选"}
                    </button>
                  )}
                </div>
                {arts.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">暂无文章</p>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {arts.map((art, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 ${
                          selected.has(idx) ? "bg-purple-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(idx)}
                          onChange={() => toggleBatchArticle(acc.fakeid, idx)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{art.title}</p>
                          <p className="text-xs text-gray-400">{art.create_time?.slice(0, 10)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // 单选模式
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">{selectedAccount?.nickname}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {articles.length > 0
                ? `最近 ${articles.length} 篇文章（已选 ${selectedArticles.size} 篇）`
                : "暂无文章"}
            </p>
          </div>
          {articles.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              {selectedArticles.size === articles.length ? "取消全选" : "全选"}
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {articles.map((art, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 ${
                selectedArticles.has(idx) ? "bg-purple-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedArticles.has(idx)}
                onChange={() => toggleArticle(idx)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{art.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{art.create_time?.slice(0, 10)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // ── 渲染 Step 3: 内容预览 ───────────

  const renderStep3 = () => {
    if (batchMode) {
      const allPreviews: { account: string; title: string; digest: string }[] = [];
      for (const acc of batchAccounts) {
        const selected = batchSelected[acc.fakeid] || new Set();
        const arts = batchArticles[acc.fakeid] || [];
        for (const idx of selected) {
          if (arts[idx]) {
            allPreviews.push({
              account: acc.nickname,
              title: arts[idx].title,
              digest: arts[idx].digest || "",
            });
          }
        }
      }
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            预览选中文章（{allPreviews.length} 篇）
          </h2>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {allPreviews.map((p, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs text-purple-600 font-medium">{p.account}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{p.title}</p>
                <div className="mt-2 rounded bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {p.digest || "(无摘要)"}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const selectedList = Array.from(selectedArticles).sort((a, b) => a - b);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          预览选中文章（{selectedList.length} 篇）
        </h2>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {selectedList.map((idx) => {
            const art = articles[idx];
            if (!art) return null;
            return (
              <div key={idx} className="rounded-lg border border-gray-100 p-4">
                <p className="text-sm font-medium text-gray-900">{art.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{art.create_time?.slice(0, 10)}</p>
                <div className="mt-2 rounded bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {art.digest || "(无摘要)"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 渲染 Step 4: 风格分析 ───────────

  const renderStep4 = () => {
    if (batchMode) {
      return (
        <div className="space-y-4">
          {/* 批量进度 */}
          {batchProgress.length === 0 && !distilling && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <p className="text-gray-500 mb-4">
                将对 {batchAccounts.length} 个公众号逐一蒸馏
              </p>
              <button
                onClick={handleDistill}
                className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition"
              >
                🚀 开始批量蒸馏
              </button>
            </div>
          )}

          {distilling && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                <span className="text-purple-700 font-medium">批量蒸馏中...</span>
              </div>
              <div className="space-y-2">
                {batchProgress.map((p, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm ${
                      p.status === "running"
                        ? "bg-purple-100 text-purple-700"
                        : p.status === "done"
                        ? "bg-green-50 text-green-700"
                        : p.status === "error"
                        ? "bg-red-50 text-red-600"
                        : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    <span>{p.accountName}</span>
                    <span className="text-xs">
                      {p.status === "pending" && "等待中"}
                      {p.status === "running" && "分析中..."}
                      {p.status === "done" && "✅ 完成"}
                      {p.status === "error" && `❌ ${p.error || "失败"}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 批量结果 */}
          {!distilling &&
            batchProgress.length > 0 &&
            batchProgress.some((p) => p.status === "done") && (
              <div className="space-y-4">
                {batchProgress
                  .filter((p) => p.status === "done" && p.result)
                  .map((p, i) => (
                    <div key={i} className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                      <h4 className="font-semibold text-purple-900 mb-3">
                        🎨 {p.result!.name} 风格特征
                      </h4>
                      <div className="space-y-1.5">
                        {p.result!.features?.map((f, j) => (
                          <div key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span className="text-gray-700">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

          {!distilling && batchProgress.length > 0 && batchProgress.every((p) => p.status === "error") && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              所有账号蒸馏均失败，请检查配置后重试
            </div>
          )}
        </div>
      );
    }

    // 单选模式
    return (
      <div className="space-y-4">
        {!distillResult && !distilling && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <p className="text-gray-500 mb-4">
              将对「{selectedAccount?.nickname}」的 {selectedArticles.size} 篇文章进行风格分析
            </p>
            <button
              onClick={handleDistill}
              className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition"
            >
              🔬 开始蒸馏分析
            </button>
          </div>
        )}

        {distilling && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-6 flex items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
            <span className="text-purple-700 font-medium">正在进行 AI 风格分析...</span>
          </div>
        )}

        {distillError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {distillError}
          </div>
        )}

        {distillResult && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
            <h3 className="font-semibold text-purple-900 mb-3">
              🎨 {distillResult.name} 风格特征
            </h3>
            <div className="space-y-1.5">
              {distillResult.features?.map((f, j) => (
                <div key={j} className="flex items-start gap-2 text-sm">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span className="text-gray-700">{f}</span>
                </div>
              ))}
            </div>
            {distillResult.features && distillResult.features.length > 0 && (
              <button
                onClick={() => setStep(5)}
                className="mt-4 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition"
              >
                💾 保存风格入库 →
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── 渲染 Step 5: 保存入库 ───────────

  const renderStep5 = () => {
    if (batchMode) {
      const doneCards = batchProgress.filter((p) => p.status === "done" && p.result);
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            批量保存风格入库（{doneCards.length} 个）
          </h2>
          {doneCards.length === 0 && (
            <p className="text-sm text-gray-400">没有可保存的蒸馏结果</p>
          )}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {doneCards.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.result!.name}</p>
                  <p className="text-xs text-gray-400">{p.result!.features?.length || 0} 个特征</p>
                </div>
                <span className="text-xs text-green-600">✅ 就绪</span>
              </div>
            ))}
          </div>

          {saving && (
            <div className="flex items-center gap-2 text-xs text-purple-600">
              <span className="h-3 w-3 animate-spin rounded-full border-1.5 border-purple-300 border-t-purple-600" />
              保存中...
            </div>
          )}
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</div>
          )}
          {savedName && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{savedName}</div>
          )}

          <div className="flex gap-3">
            {doneCards.length > 0 && (
              <button
                onClick={handleBatchSave}
                disabled={saving}
                className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
              >
                💾 全部保存入库
              </button>
            )}
            <button
              onClick={resetWizard}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              🔄 开始新一轮蒸馏
            </button>
          </div>
        </div>
      );
    }

    // 单选模式
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">保存风格卡</h2>
        {!distillResult ? (
          <p className="text-sm text-gray-400">请先在步骤 4 完成蒸馏分析</p>
        ) : (
          <>
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
              <p className="text-sm font-medium text-purple-900">{distillResult.name}</p>
              <p className="text-xs text-purple-500 mt-0.5">来源：{distillResult.source}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {distillResult.features?.map((f, j) => (
                  <span key={j} className="text-xs bg-white text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {saving && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <span className="h-3 w-3 animate-spin rounded-full border-1.5 border-purple-300 border-t-purple-600" />
                保存中...
              </div>
            )}
            {saveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</div>
            )}
            {savedName && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">✅ {savedName} 已保存</div>
            )}

            <div className="flex gap-3">
              {!savedName && (
                <button
                  onClick={() => handleSave(distillResult)}
                  disabled={saving}
                  className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  💾 保存到风格库
                </button>
              )}
              <button
                onClick={resetWizard}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                🔄 开始新一轮蒸馏
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── 当前步骤内容 ────────────────────

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  // ── 导航按钮 ────────────────────────

  const renderNavButtons = () => {
    const nextDisabled = (() => {
      if (step === 1) return !canGoStep2();
      if (step === 2) return !canGoStep3();
      if (step === 4) {
        if (batchMode) return batchProgress.some((p) => p.status === "running");
        return !distillResult || distilling;
      }
      return false;
    })();

    const nextLabel = (() => {
      if (step === 3) return batchMode ? "🚀 开始批量蒸馏" : "🔬 开始蒸馏分析";
      if (step === 4) return "💾 保存风格 →";
      if (step === 5) return "✅ 完成";
      return "下一步 →";
    })();

    const handleNext = () => {
      if (step === 3) {
        handleDistill();
        setStep(4);
        return;
      }
      if (step === 4) {
        setStep(5);
        return;
      }
      if (step === 5) {
        resetWizard();
        return;
      }
      goNext();
    };

    return (
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={goPrev}
          disabled={step === 1}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ← 上一步
        </button>
        <span className="text-xs text-gray-400">
          步骤 {step} / {totalSteps}
        </span>
        <button
          onClick={handleNext}
          disabled={nextDisabled}
          className={`rounded-lg px-6 py-2 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${
            step === 5
              ? "bg-green-600 hover:bg-green-700"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {nextLabel}
        </button>
      </div>
    );
  };

  // ── 主渲染 ──────────────────────────

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">风格蒸馏</h1>
        <p className="mt-1 text-sm text-gray-500">
          搜索公众号 → 拉取最新文章 → 选择蒸馏 → AI 提取写作风格
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：向导主体 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 步骤指示器 */}
          {renderStepIndicator()}

          {/* 步骤内容 */}
          <div className="min-h-[360px]">{renderStepContent()}</div>

          {/* 导航按钮 */}
          {renderNavButtons()}
        </div>

        {/* 右侧：已有风格卡 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              已有风格卡
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({loadingStyles ? "..." : styles.length})
              </span>
            </h2>
            {loadingStyles ? (
              <p className="text-sm text-gray-400">加载中...</p>
            ) : styles.length === 0 ? (
              <p className="text-sm text-gray-400">暂无风格卡，蒸馏后会自动出现在这里</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {styles.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-lg border p-4 ${
                      s.name === distillResult?.name
                        ? "border-purple-300 bg-purple-50 ring-2 ring-purple-200"
                        : "border-gray-100 hover:border-gray-200"
                    } transition`}
                  >
                    <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.featureCount} 个特征 · 来源 {s.source}
                    </p>
                    {s.features?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.features.slice(0, 3).map((f, j) => (
                          <span
                            key={j}
                            className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                          >
                            {f}
                          </span>
                        ))}
                        {s.features.length > 3 && (
                          <span className="text-[11px] text-gray-400">
                            +{s.features.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 全局错误 */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}