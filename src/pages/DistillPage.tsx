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

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StepDef {
  num: WizardStep;
  label: string;
}

interface BatchProgress {
  accountName: string;
  status: "pending" | "running" | "done" | "error";
  result?: StyleCard;
  error?: string;
}

const STEPS: StepDef[] = [
  { num: 1, label: "搜索选择" },
  { num: 2, label: "文章选择" },
  { num: 3, label: "内容预览" },
  { num: 4, label: "风格分析" },
  { num: 5, label: "保存入库" },
];

// ── 共享样式 ──
const cardBase = "rounded-lg border border-white/6 bg-[#1c1c1e]";
const inputClass = "w-full rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-2 text-[13px] text-white placeholder:text-[#5c5c5e] focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20";
const btnPrimary = "rounded-md bg-[#5e6ad2] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#6e7ae0] transition-colors disabled:opacity-40";
const btnSecondary = "rounded-md border border-white/10 px-4 py-2 text-[13px] text-[#8a8a8e] hover:bg-white/5 hover:text-white transition-colors disabled:opacity-30";

export default function DistillPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  const [batchMode, setBatchMode] = useState(false);
  const [batchAccounts, setBatchAccounts] = useState<WxAccountSearchResult[]>([]);
  const [batchArticles, setBatchArticles] = useState<Record<string, WxArticle[]>>({});
  const [batchProgress, setBatchProgress] = useState<BatchProgress[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WxAccountSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WxAccountSearchResult | null>(null);

  const [articles, setArticles] = useState<WxArticle[]>([]);
  const [_loadingArticles, setLoadingArticles] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<number>>(new Set());

  const [distilling, setDistilling] = useState(false);
  const [distillResult, setDistillResult] = useState<StyleCard | null>(null);
  const [distillError, setDistillError] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [error, setError] = useState("");

  const [batchSelected, setBatchSelected] = useState<Record<string, Set<number>>>({});

  const loadStyles = useCallback(async () => {
    try { const data = await apiGetStyles(); setStyles(data); } catch {} finally { setLoadingStyles(false); }
  }, []);
  useEffect(() => { loadStyles(); }, [loadStyles]);

  // ── Search ──
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try { setSearchResults(await apiSearchAccounts(q.trim(), 1, 10)); setShowDropdown(true); }
    catch { setSearchResults([]); } finally { setSearching(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => doSearch(searchQuery), 400); return () => clearTimeout(t); }, [searchQuery, doSearch]);

  const handleSelectAccount = async (item: WxAccountSearchResult) => {
    if (batchMode) {
      setBatchAccounts((prev) => {
        const exists = prev.find((a) => a.fakeid === item.fakeid);
        if (exists) return prev.filter((a) => a.fakeid !== item.fakeid);
        return [...prev, item];
      });
      setSearchQuery(""); setShowDropdown(false);
      return;
    }
    setSelectedAccount(item); setArticles([]); setSelectedArticles(new Set()); setDistillResult(null); setError("");
    setShowDropdown(false); setSearchQuery(item.nickname);
    setLoadingArticles(true);
    try { setArticles(await apiFetchArticles(item.fakeid, 10)); } catch { setError("获取文章失败"); setArticles([]); }
    finally { setLoadingArticles(false); }
  };

  const fetchBatchArticles = async () => {
    setLoadingArticles(true);
    const all: Record<string, WxArticle[]> = {};
    for (const acc of batchAccounts) { try { all[acc.fakeid] = await apiFetchArticles(acc.fakeid, 10); } catch { all[acc.fakeid] = []; } }
    setBatchArticles(all);
    setLoadingArticles(false);
  };

  const toggleBatchArticle = (fakeid: string, idx: number) => {
    setBatchSelected((prev) => {
      const next = { ...prev };
      if (!next[fakeid]) next[fakeid] = new Set(); else next[fakeid] = new Set(next[fakeid]);
      if (next[fakeid].has(idx)) next[fakeid].delete(idx); else next[fakeid].add(idx);
      return next;
    });
  };
  const toggleBatchAll = (fakeid: string, total: number) => {
    setBatchSelected((prev) => {
      const next = { ...prev };
      const cur = next[fakeid] ? new Set(next[fakeid]) : new Set();
      next[fakeid] = cur.size === total ? new Set() : new Set(Array.from({ length: total }, (_, i) => i));
      return next;
    });
  };
  const toggleArticle = (idx: number) => {
    setSelectedArticles((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  };
  const toggleAll = () => setSelectedArticles(selectedArticles.size === articles.length ? new Set() : new Set(articles.map((_, i) => i)));

  const canGoStep2 = () => batchMode ? batchAccounts.length > 0 : !!(selectedAccount && articles.length > 0);
  const canGoStep3 = () => batchMode ? Object.values(batchSelected).some((s) => s.size > 0) : selectedArticles.size > 0;

  const goNext = () => { if (step === 1 && batchMode && batchAccounts.length > 0) fetchBatchArticles(); if (step < 5) setStep((s) => (s + 1) as WizardStep); };
  const goPrev = () => { if (step > 1) setStep((s) => (s - 1) as WizardStep); };

  const handleDistill = async () => {
    setDistilling(true); setDistillError(""); setDistillResult(null);
    if (batchMode) {
      const progress: BatchProgress[] = batchAccounts.map((acc) => ({ accountName: acc.nickname, status: "pending" }));
      setBatchProgress(progress);
      for (let i = 0; i < batchAccounts.length; i++) {
        const acc = batchAccounts[i];
        const selected = batchSelected[acc.fakeid] || new Set();
        const arts = batchArticles[acc.fakeid] || [];
        const texts = Array.from(selected).sort((a, b) => a - b).map((idx) => arts[idx]?.digest || "").filter(Boolean);
        if (texts.length === 0) { setBatchProgress((prev) => { const next = [...prev]; next[i] = { ...next[i], status: "error", error: "未选择文章" }; return next; }); continue; }
        setBatchProgress((prev) => { const next = [...prev]; next[i] = { ...next[i], status: "running" }; return next; });
        try {
          const result = await apiDistill(acc.nickname, texts);
          setBatchProgress((prev) => { const next = [...prev]; next[i] = result.style ? { ...next[i], status: "done", result: result.style } : { ...next[i], status: "error", error: result.message || "蒸馏未返回结果" }; return next; });
        } catch (err) {
          setBatchProgress((prev) => { const next = [...prev]; next[i] = { ...next[i], status: "error", error: err instanceof Error ? err.message : "蒸馏失败" }; return next; });
        }
      }
    } else {
      if (!selectedAccount || selectedArticles.size === 0) return;
      try {
        const selectedTexts = Array.from(selectedArticles).sort((a, b) => a - b).map((idx) => articles[idx]?.digest || "").filter(Boolean);
        const result = await apiDistill(selectedAccount.nickname, selectedTexts);
        if (result.style) { setDistillResult(result.style); loadStyles(); } else { setDistillError(result.message || "蒸馏未返回结果"); }
      } catch (err) { setDistillError(err instanceof Error ? err.message : "蒸馏失败"); }
    }
    setDistilling(false);
  };

  const handleSave = async (card: StyleCard) => {
    setSaving(true); setSaveError("");
    try { await apiAddStyle({ name: card.name, source: card.source, features: card.features }); setSavedName(card.name); loadStyles(); }
    catch (err) { setSaveError(err instanceof Error ? err.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const handleBatchSave = async () => {
    setSaving(true); setSaveError("");
    let saved = 0, failed = 0;
    for (const p of batchProgress) {
      if (p.status === "done" && p.result) {
        try { await apiAddStyle({ name: p.result.name, source: p.result.source, features: p.result.features }); saved++; } catch { failed++; }
      }
    }
    setSaving(false);
    if (saved > 0) { setSavedName(`${saved} 个风格已保存${failed > 0 ? `，${failed} 个失败` : ""}`); loadStyles(); }
    else { setSaveError("没有可保存的风格"); }
  };

  const resetWizard = () => {
    setStep(1); setSelectedAccount(null); setArticles([]); setSelectedArticles(new Set()); setDistillResult(null); setDistillError("");
    setSavedName(""); setSaveError(""); setError(""); setSearchQuery(""); setSearchResults([]);
    setBatchAccounts([]); setBatchArticles({}); setBatchSelected({}); setBatchProgress([]);
  };

  // ── Step indicator ──
  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const isActive = step === s.num;
          const isCompleted = step > s.num;
          return (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  isCompleted ? "bg-[#5e6ad2] text-white" : isActive ? "bg-[#5e6ad2]/15 text-[#5e6ad2] ring-2 ring-[#5e6ad2]" : "bg-white/5 text-[#5c5c5e]"
                }`}>
                  {isCompleted ? "✓" : s.num}
                </div>
                <p className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  isActive ? "text-[#5e6ad2]" : isCompleted ? "text-[#5e6ad2]" : "text-[#5c5c5e]"
                }`}>{s.label}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-16px]">
                  <div className={`h-full rounded transition ${isCompleted ? "bg-[#5e6ad2]" : "bg-white/10"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Step 1 ──
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={batchMode} onChange={(e) => { setBatchMode(e.target.checked); setBatchAccounts([]); setSelectedAccount(null); setArticles([]); setBatchArticles({}); setBatchSelected({}); setSearchQuery(""); }}
            className="h-4 w-4 rounded border-white/20 bg-[#0d0d0d] text-[#5e6ad2] focus:ring-[#5e6ad2]" />
          <span className="text-sm text-[#8a8a8e]">批量蒸馏模式</span>
        </label>
        {batchMode && <span className="text-xs text-[#5e6ad2] bg-[#5e6ad2]/10 px-2 py-0.5 rounded-full">已选 {batchAccounts.length} 个账号</span>}
      </div>
      <div className={cardBase + " p-6"}>
        <h2 className="mb-4 text-sm font-semibold text-[#fafafa]">{batchMode ? "添加公众号（可多选）" : "搜索公众号"}</h2>
        <div className="relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="搜索微信公众号名称，如「AI」「产品」..." className={inputClass} />
          {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5c5c5e]">搜索中...</span>}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#1c1c1e] shadow-lg">
              {searchResults.map((item) => {
                const isSelected = batchMode ? batchAccounts.some((a) => a.fakeid === item.fakeid) : selectedAccount?.fakeid === item.fakeid;
                return (
                  <div key={item.fakeid} onClick={() => handleSelectAccount(item)}
                    className={`cursor-pointer px-4 py-3 hover:bg-white/5 transition flex items-center justify-between ${isSelected ? "bg-[#5e6ad2]/10" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#fafafa] truncate">{item.nickname}</p>
                      <p className="text-xs text-[#5c5c5e] truncate mt-0.5">{item.signature || "暂无简介"}</p>
                    </div>
                    <span className={`ml-3 shrink-0 text-xs ${isSelected ? "text-[#5e6ad2] font-medium" : "text-[#5e6ad2]"}`}>{isSelected ? "✓ 已选" : "选择 →"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {batchMode && batchAccounts.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-[#8a8a8e] font-medium">已选账号：</p>
            {batchAccounts.map((acc) => (
              <div key={acc.fakeid} className="flex items-center justify-between rounded-md bg-[#5e6ad2]/10 px-3 py-2">
                <span className="text-sm text-[#fafafa]">{acc.nickname}</span>
                <button onClick={() => setBatchAccounts((prev) => prev.filter((a) => a.fakeid !== acc.fakeid))} className="text-xs text-[#e5484d] hover:text-red-400">移除</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {!batchMode && selectedAccount && (
        <div className={cardBase + " border-[#5e6ad2]/30 bg-[#5e6ad2]/5 p-4 flex items-center justify-between"}>
          <div>
            <span className="text-sm font-medium text-[#fafafa]">{selectedAccount.nickname}</span>
            <span className="ml-2 text-xs text-[#5e6ad2]">{articles.length > 0 ? `${articles.length} 篇文章已就绪` : "加载中..."}</span>
          </div>
          <span className="text-xs bg-[#5e6ad2]/15 text-[#5e6ad2] px-2 py-0.5 rounded-full">已选择</span>
        </div>
      )}
    </div>
  );

  // ── Step 2 ──
  const renderStep2 = () => {
    if (batchMode) {
      return (
        <div className="space-y-6">
          {batchAccounts.map((acc) => {
            const arts = batchArticles[acc.fakeid] || [];
            const selected = batchSelected[acc.fakeid] || new Set();
            return (
              <div key={acc.fakeid} className={cardBase}>
                <div className="flex items-center justify-between border-b border-white/6 px-6 py-3">
                  <h3 className="font-semibold text-[#fafafa] text-sm">{acc.nickname}</h3>
                  {arts.length > 0 && <button onClick={() => toggleBatchAll(acc.fakeid, arts.length)} className="text-xs text-[#5e6ad2] hover:text-[#7b85e8]">{selected.size === arts.length ? "取消全选" : "全选"}</button>}
                </div>
                {arts.length === 0 ? <p className="py-4 text-center text-xs text-[#5c5c5e]">暂无文章</p> : (
                  <div className="divide-y divide-white/4 max-h-60 overflow-y-auto">
                    {arts.map((art, idx) => (
                      <label key={idx} className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-white/[0.02] ${selected.has(idx) ? "bg-[#5e6ad2]/5" : ""}`}>
                        <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleBatchArticle(acc.fakeid, idx)} className="h-4 w-4 rounded border-white/20 bg-[#0d0d0d] text-[#5e6ad2]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#fafafa] truncate">{art.title}</p>
                          <p className="text-xs text-[#5c5c5e]">{art.create_time?.slice(0, 10)}</p>
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
    return (
      <div className={cardBase}>
        <div className="flex items-center justify-between border-b border-white/6 px-6 py-4">
          <div>
            <h3 className="font-semibold text-[#fafafa]">{selectedAccount?.nickname}</h3>
            <p className="text-xs text-[#8a8a8e] mt-0.5">{articles.length > 0 ? `最近 ${articles.length} 篇文章（已选 ${selectedArticles.size} 篇）` : "暂无文章"}</p>
          </div>
          {articles.length > 0 && <button onClick={toggleAll} className="text-xs text-[#5e6ad2] hover:text-[#7b85e8]">{selectedArticles.size === articles.length ? "取消全选" : "全选"}</button>}
        </div>
        <div className="divide-y divide-white/4 max-h-80 overflow-y-auto">
          {articles.map((art, idx) => (
            <label key={idx} className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-white/[0.02] ${selectedArticles.has(idx) ? "bg-[#5e6ad2]/5" : ""}`}>
              <input type="checkbox" checked={selectedArticles.has(idx)} onChange={() => toggleArticle(idx)} className="h-4 w-4 rounded border-white/20 bg-[#0d0d0d] text-[#5e6ad2]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#fafafa] truncate">{art.title}</p>
                <p className="text-xs text-[#5c5c5e] mt-0.5">{art.create_time?.slice(0, 10)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // ── Step 3 ──
  const renderStep3 = () => {
    if (batchMode) {
      const allPreviews: { account: string; title: string; digest: string }[] = [];
      for (const acc of batchAccounts) {
        const selected = batchSelected[acc.fakeid] || new Set();
        const arts = batchArticles[acc.fakeid] || [];
        for (const idx of selected) { if (arts[idx]) allPreviews.push({ account: acc.nickname, title: arts[idx].title, digest: arts[idx].digest || "" }); }
      }
      return (
        <div className={cardBase + " p-6"}>
          <h2 className="mb-4 text-sm font-semibold text-[#fafafa]">预览选中文章（{allPreviews.length} 篇）</h2>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {allPreviews.map((p, i) => (
              <div key={i} className="rounded-md border border-white/6 p-4">
                <p className="text-xs text-[#5e6ad2] font-medium">{p.account}</p>
                <p className="text-sm font-medium text-[#fafafa] mt-1">{p.title}</p>
                <div className="mt-2 rounded bg-white/5 p-3 text-xs text-[#8a8a8e] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">{p.digest || "(无摘要)"}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    const selectedList = Array.from(selectedArticles).sort((a, b) => a - b);
    return (
      <div className={cardBase + " p-6"}>
        <h2 className="mb-4 text-sm font-semibold text-[#fafafa]">预览选中文章（{selectedList.length} 篇）</h2>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {selectedList.map((idx) => {
            const art = articles[idx]; if (!art) return null;
            return (
              <div key={idx} className="rounded-md border border-white/6 p-4">
                <p className="text-sm font-medium text-[#fafafa]">{art.title}</p>
                <p className="text-xs text-[#5c5c5e] mt-0.5">{art.create_time?.slice(0, 10)}</p>
                <div className="mt-2 rounded bg-white/5 p-3 text-xs text-[#8a8a8e] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">{art.digest || "(无摘要)"}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Step 4 ──
  const renderStep4 = () => {
    if (batchMode) {
      return (
        <div className="space-y-4">
          {batchProgress.length === 0 && !distilling && (
            <div className={cardBase + " border-dashed p-12 text-center"}>
              <p className="text-[#8a8a8e] mb-4">将对 {batchAccounts.length} 个公众号逐一蒸馏</p>
              <button onClick={handleDistill} className={btnPrimary}>🚀 开始批量蒸馏</button>
            </div>
          )}
          {distilling && (
            <div className={cardBase + " border-[#5e6ad2]/30 bg-[#5e6ad2]/5 p-6"}>
              <div className="flex items-center gap-3 mb-4">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#5e6ad2]/30 border-t-[#5e6ad2]" />
                <span className="text-[#5e6ad2] font-medium">批量蒸馏中...</span>
              </div>
              <div className="space-y-2">
                {batchProgress.map((p, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-md px-4 py-2 text-sm ${
                    p.status === "running" ? "bg-[#5e6ad2]/10 text-[#5e6ad2]" : p.status === "done" ? "bg-[#34c759]/10 text-[#34c759]" : p.status === "error" ? "bg-[#e5484d]/10 text-[#e5484d]" : "bg-white/5 text-[#5c5c5e]"
                  }`}>
                    <span>{p.accountName}</span>
                    <span className="text-xs">{p.status === "pending" ? "等待中" : p.status === "running" ? "分析中..." : p.status === "done" ? "✅ 完成" : `❌ ${p.error || "失败"}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!distilling && batchProgress.length > 0 && batchProgress.some((p) => p.status === "done") && (
            <div className="space-y-4">
              {batchProgress.filter((p) => p.status === "done" && p.result).map((p, i) => (
                <div key={i} className={cardBase + " border-[#5e6ad2]/30 bg-[#5e6ad2]/5 p-5"}>
                  <h4 className="font-semibold text-[#5e6ad2] mb-3">🎨 {p.result!.name} 风格特征</h4>
                  <div className="space-y-1.5">
                    {p.result!.features?.map((f, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm"><span className="text-[#5e6ad2] mt-0.5">•</span><span className="text-[#d4d4d8]">{f}</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {!distillResult && !distilling && (
          <div className={cardBase + " border-dashed p-12 text-center"}>
            <p className="text-[#8a8a8e] mb-4">将对「{selectedAccount?.nickname}」的 {selectedArticles.size} 篇文章进行风格分析</p>
            <button onClick={handleDistill} className={btnPrimary}>🔬 开始蒸馏分析</button>
          </div>
        )}
        {distilling && (
          <div className={cardBase + " border-[#5e6ad2]/30 bg-[#5e6ad2]/5 p-6 flex items-center gap-3"}>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#5e6ad2]/30 border-t-[#5e6ad2]" />
            <span className="text-[#5e6ad2] font-medium">正在进行 AI 风格分析...</span>
          </div>
        )}
        {distillError && <div className="rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-4 py-3 text-sm text-[#e5484d]">{distillError}</div>}
        {distillResult && (
          <div className={cardBase + " border-[#5e6ad2]/30 bg-[#5e6ad2]/5 p-5"}>
            <h3 className="font-semibold text-[#5e6ad2] mb-3">🎨 {distillResult.name} 风格特征</h3>
            <div className="space-y-1.5">
              {distillResult.features?.map((f, j) => (
                <div key={j} className="flex items-start gap-2 text-sm"><span className="text-[#5e6ad2] mt-0.5">•</span><span className="text-[#d4d4d8]">{f}</span></div>
              ))}
            </div>
            {distillResult.features && distillResult.features.length > 0 && <button onClick={() => setStep(5)} className="mt-4 rounded-md bg-[#5e6ad2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6e7ae0] transition-colors">💾 保存风格入库 →</button>}
          </div>
        )}
      </div>
    );
  };

  // ── Step 5 ──
  const renderStep5 = () => {
    if (batchMode) {
      const doneCards = batchProgress.filter((p) => p.status === "done" && p.result);
      return (
        <div className={cardBase + " p-6 space-y-4"}>
          <h2 className="text-sm font-semibold text-[#fafafa]">批量保存风格入库（{doneCards.length} 个）</h2>
          {doneCards.length === 0 && <p className="text-sm text-[#5c5c5e]">没有可保存的蒸馏结果</p>}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {doneCards.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-white/6 px-4 py-3">
                <div><p className="text-sm font-medium text-[#fafafa]">{p.result!.name}</p><p className="text-xs text-[#5c5c5e]">{p.result!.features?.length || 0} 个特征</p></div>
                <span className="text-xs text-[#34c759]">✅ 就绪</span>
              </div>
            ))}
          </div>
          {saving && <div className="flex items-center gap-2 text-xs text-[#5e6ad2]"><span className="h-3 w-3 animate-spin rounded-full border-1.5 border-[#5e6ad2]/30 border-t-[#5e6ad2]" />保存中...</div>}
          {saveError && <div className="rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-3 py-2 text-xs text-[#e5484d]">{saveError}</div>}
          {savedName && <div className="rounded-md border border-[#34c759]/30 bg-[#34c759]/10 px-3 py-2 text-xs text-[#34c759]">{savedName}</div>}
          <div className="flex gap-3">
            {doneCards.length > 0 && <button onClick={handleBatchSave} disabled={saving} className="rounded-md bg-[#34c759] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#3dd96c] disabled:opacity-50 transition-colors">💾 全部保存入库</button>}
            <button onClick={resetWizard} className={btnSecondary}>🔄 开始新一轮蒸馏</button>
          </div>
        </div>
      );
    }
    return (
      <div className={cardBase + " p-6 space-y-4"}>
        <h2 className="text-sm font-semibold text-[#fafafa]">保存风格卡</h2>
        {!distillResult ? <p className="text-sm text-[#5c5c5e]">请先在步骤 4 完成蒸馏分析</p> : (
          <>
            <div className="rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 p-4">
              <p className="text-sm font-medium text-[#5e6ad2]">{distillResult.name}</p>
              <p className="text-xs text-[#8a8a8e] mt-0.5">来源：{distillResult.source}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {distillResult.features?.map((f, j) => (
                  <span key={j} className="text-xs bg-[#0d0d0d] text-[#5e6ad2] px-2 py-0.5 rounded-full border border-[#5e6ad2]/30">{f}</span>
                ))}
              </div>
            </div>
            {saving && <div className="flex items-center gap-2 text-xs text-[#5e6ad2]"><span className="h-3 w-3 animate-spin rounded-full border-1.5 border-[#5e6ad2]/30 border-t-[#5e6ad2]" />保存中...</div>}
            {saveError && <div className="rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-3 py-2 text-xs text-[#e5484d]">{saveError}</div>}
            {savedName && <div className="rounded-md border border-[#34c759]/30 bg-[#34c759]/10 px-3 py-2 text-xs text-[#34c759]">✅ {savedName} 已保存</div>}
            <div className="flex gap-3">
              {!savedName && <button onClick={() => handleSave(distillResult)} disabled={saving} className="rounded-md bg-[#34c759] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#3dd96c] disabled:opacity-50 transition-colors">💾 保存到风格库</button>}
              <button onClick={resetWizard} className={btnSecondary}>🔄 开始新一轮蒸馏</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderStepContent = () => { switch (step) { case 1: return renderStep1(); case 2: return renderStep2(); case 3: return renderStep3(); case 4: return renderStep4(); case 5: return renderStep5(); default: return null; } };

  const nextDisabled = (() => {
    if (step === 1) return !canGoStep2(); if (step === 2) return !canGoStep3(); if (step === 4) return batchMode ? batchProgress.some((p) => p.status === "running") : !distillResult || distilling; return false;
  })();
  const nextLabel = (() => { if (step === 3) return batchMode ? "🚀 开始批量蒸馏" : "🔬 开始蒸馏分析"; if (step === 4) return "💾 保存风格 →"; if (step === 5) return "✅ 完成"; return "下一步 →"; })();
  const handleNext = () => { if (step === 3) { handleDistill(); setStep(4); return; } if (step === 4) { setStep(5); return; } if (step === 5) { resetWizard(); return; } goNext(); };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-[15px] font-semibold text-[#fafafa]">风格蒸馏</h1>
        <p className="mt-1 text-[12px] text-[#8a8a8e]">搜索公众号 → 拉取最新文章 → 选择蒸馏 → AI 提取写作风格</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {renderStepIndicator()}
          <div className="min-h-[360px]">{renderStepContent()}</div>
          <div className="flex items-center justify-between mt-6">
            <button onClick={goPrev} disabled={step === 1} className={btnSecondary}>{step === 1 ? "" : "← 上一步"}</button>
            <span className="text-xs text-[#5c5c5e]">步骤 {step} / {STEPS.length}</span>
            <button onClick={handleNext} disabled={nextDisabled} className={step === 5 ? "rounded-md bg-[#34c759] px-6 py-2 text-[13px] font-semibold text-white hover:bg-[#3dd96c] disabled:opacity-40 transition-colors" : btnPrimary}>{nextLabel}</button>
          </div>
        </div>
        <div className="space-y-4">
          <div className={cardBase + " p-6"}>
            <h2 className="mb-4 text-sm font-semibold text-[#fafafa]">已有风格卡<span className="ml-2 text-sm font-normal text-[#8a8a8e]">({loadingStyles ? "..." : styles.length})</span></h2>
            {loadingStyles ? <p className="text-sm text-[#5c5c5e]">加载中...</p> : styles.length === 0 ? <p className="text-sm text-[#5c5c5e]">暂无风格卡</p> : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {styles.map((s) => (
                  <div key={s.id} className={`rounded-lg border p-4 ${s.name === distillResult?.name ? "border-[#5e6ad2] bg-[#5e6ad2]/10 ring-2 ring-[#5e6ad2]/20" : "border-white/6 hover:border-white/10"} transition`}>
                    <p className="font-semibold text-[#fafafa] text-sm">{s.name}</p>
                    <p className="text-xs text-[#8a8a8e] mt-0.5">{s.featureCount} 个特征 · 来源 {s.source}</p>
                    {s.features?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.features.slice(0, 3).map((f, j) => <span key={j} className="text-[11px] bg-white/5 text-[#8a8a8e] px-1.5 py-0.5 rounded">{f}</span>)}
                        {s.features.length > 3 && <span className="text-[11px] text-[#5c5c5e]">+{s.features.length - 3}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div className="mt-4 rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-4 py-3 text-sm text-[#e5484d]">{error}</div>}
    </div>
  );
}
