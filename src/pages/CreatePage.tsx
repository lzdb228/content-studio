import { useEffect, useState } from "react";
import {
  apiGetStyles,
  apiGetAccounts,
  apiRewrite,
  apiScan,
  apiSaveArticle,
  apiPublish,
  StyleCard,
  Account,
  RewriteResult,
  ScanResult,
} from "../lib/api";

type Tab = "write" | "scan" | "preview";

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [artType, setArtType] = useState("原创创作");
  const [benchmarkAccount, setBenchmarkAccount] = useState("");

  const [styles, setStyles] = useState<StyleCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [rewriteError, setRewriteError] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const [tab, setTab] = useState<Tab>("write");

  useEffect(() => {
    apiGetStyles().then(setStyles).catch(() => {});
    apiGetAccounts().then(setAccounts).catch(() => {});
  }, []);

  const handleRewrite = async () => {
    if (!content.trim()) return;
    setRewriting(true);
    setRewriteError("");
    setRewriteResult(null);
    setTab("write");
    try {
      const result = await apiRewrite(content, selectedStyle);
      setRewriteResult(result);
      setContent(result.rewritten);
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : "改写失败");
    } finally {
      setRewriting(false);
    }
  };

  const handleScan = async () => {
    const text = rewriteResult?.rewritten || content;
    if (!text.trim()) return;
    setScanning(true);
    setScanError("");
    setScanResult(null);
    try {
      const result = await apiScan(text);
      setScanResult(result);
      setTab("scan");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "扫描失败");
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setActionMsg("请填写标题和内容");
      return;
    }
    setSaving(true);
    setActionMsg("");
    try {
      await apiSaveArticle({
        title: title.trim(),
        content: content.trim(),
        style: selectedStyle,
        art_type: artType,
        source: artType === "对标创作" && benchmarkAccount ? `对标:${benchmarkAccount}` : artType,
      });
      setActionMsg("✅ 已保存到素材库");
    } catch (err) {
      setActionMsg("保存失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) {
      setActionMsg("请填写标题和内容");
      return;
    }
    setPublishing(true);
    setActionMsg("");
    try {
      await apiPublish({ title: title.trim(), content: content.trim() });
      setActionMsg("✅ 已发布到微信草稿箱");
    } catch (err) {
      setActionMsg("发布失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setPublishing(false);
    }
  };

  const scoreBar = (label: string, score: number, max = 5) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#8a8a8e] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score <= 2 ? "bg-[#34c759]" : score <= 3 ? "bg-[#f5a623]" : "bg-[#e5484d]"
          }`}
          style={{ width: `${(score / max) * 100}%` }}
        />
      </div>
      <span className="text-xs text-[#8a8a8e] w-4 text-right">{score}</span>
    </div>
  );

  // ── 共享 input/select 样式 ──
  const inputClass = "w-full rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-2 text-[13px] text-white placeholder:text-[#5c5c5e] focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20";
  const selectClass = "rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-2 text-[13px] text-white focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20";

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-[15px] font-semibold text-[#fafafa]">创作工坊</h1>
        <p className="mt-1 text-[12px] text-[#8a8a8e]">
          AI 改写 + 去AI扫描 + 保存入库 + 一键发布
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：编辑区 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 文章类型选择器 */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex gap-3">
              <button
                onClick={() => { setArtType("原创创作"); setBenchmarkAccount(""); }}
                className={`rounded-lg border p-4 text-left w-44 transition-all ${
                  artType === "原创创作"
                    ? "border-[#5e6ad2] bg-[#5e6ad2]/10 ring-2 ring-[#5e6ad2]/20"
                    : "border-white/6 bg-[#1c1c1e] hover:border-white/10"
                }`}
              >
                <div className="text-2xl mb-1">✍️</div>
                <p className="text-sm font-semibold text-[#fafafa]">原创创作</p>
                <p className="text-xs text-[#5c5c5e] mt-1">独立创作新文章，可选择风格模板辅助</p>
              </button>

              <button
                onClick={() => setArtType("对标创作")}
                className={`rounded-lg border p-4 text-left w-44 transition-all ${
                  artType === "对标创作"
                    ? "border-[#f5a623] bg-[#f5a623]/10 ring-2 ring-[#f5a623]/20"
                    : "border-white/6 bg-[#1c1c1e] hover:border-white/10"
                }`}
              >
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-sm font-semibold text-[#fafafa]">对标创作</p>
                <p className="text-xs text-[#5c5c5e] mt-1">参考对标账号风格进行仿写创作</p>
              </button>
            </div>

            {artType === "对标创作" && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-[#8a8a8e] mb-1">
                  对标账号
                </label>
                <select
                  value={benchmarkAccount}
                  onChange={(e) => setBenchmarkAccount(e.target.value)}
                  className={`${selectClass} w-full border-[#f5a623]/30 focus:border-[#f5a623]`}
                >
                  <option value="">选择对标账号...</option>
                  {accounts
                    .filter((a) => a.status === "活跃")
                    .map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} {a.shortName ? `(${a.shortName})` : ""}
                      </option>
                    ))}
                </select>
                {benchmarkAccount && (
                  <p className="mt-1 text-xs text-[#f5a623]">
                    🎯 将以「{benchmarkAccount}」的风格为对标参考进行创作
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 风格选择 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#8a8a8e] whitespace-nowrap">风格模板：</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className={`${selectClass} flex-1`}
            >
              <option value="">不选择（自由创作）</option>
              {styles.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.featureCount} 特征)
                </option>
              ))}
            </select>
          </div>

          {/* 标题 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题..."
            className={inputClass}
          />

          {/* 标签切换 */}
          <div className="flex gap-1 rounded-md bg-white/5 p-1">
            {([
              ["write", "✏️ 编辑"],
              ["scan", "🔍 扫描结果"],
              ["preview", "👁 预览"],
            ] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded py-1.5 text-xs font-medium transition ${
                  tab === k
                    ? "bg-[#1c1c1e] text-[#fafafa]"
                    : "text-[#8a8a8e] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 编辑 */}
          {tab === "write" && (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此输入或粘贴文章内容..."
              rows={14}
              className="w-full rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-3 text-[13px] text-white placeholder:text-[#5c5c5e] leading-relaxed focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20 resize-y"
            />
          )}

          {/* 扫描 */}
          {tab === "scan" && scanResult && (
            <div className="rounded-lg border border-white/6 bg-[#1c1c1e] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#fafafa]">
                  去AI扫描报告
                </h3>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    scanResult.total_score <= 15
                      ? "bg-[#34c759]/15 text-[#34c759]"
                      : scanResult.total_score <= 22
                      ? "bg-[#f5a623]/15 text-[#f5a623]"
                      : "bg-[#e5484d]/15 text-[#e5484d]"
                  }`}
                >
                  {scanResult.verdict}
                  {" · "}
                  {scanResult.total_score}/{scanResult.max_score} 分
                </span>
              </div>

              <div className="space-y-2">
                {scoreBar("AI痕迹", scanResult.scores.ai_traces)}
                {scoreBar("句式变化", scanResult.scores.sentence_variety)}
                {scoreBar("个人视角", scanResult.scores.personal_voice)}
                {scoreBar("重复检测", scanResult.scores.repetition)}
                {scoreBar("互动感", scanResult.scores.interaction)}
              </div>

              <div className="rounded-md bg-white/5 p-3">
                <p className="text-xs text-[#8a8a8e] leading-relaxed">
                  {scanResult.summary}
                </p>
              </div>

              <div className="flex gap-4 text-xs text-[#5c5c5e]">
                <span>字数：{scanResult.stats.char_count}</span>
                <span>句数：{scanResult.stats.sentence_count}</span>
                <span>均句长：{scanResult.stats.avg_sentence_len.toFixed(1)}</span>
              </div>
            </div>
          )}

          {tab === "scan" && !scanResult && (
            <div className="rounded-lg border border-white/6 bg-[#1c1c1e] p-8 text-center text-sm text-[#5c5c5e]">
              尚未扫描，请先点击「🔍 AI扫描」
            </div>
          )}

          {/* 预览 */}
          {tab === "preview" && (
            <div className="rounded-lg border border-white/6 bg-[#1c1c1e] p-6">
              {title && (
                <h2 className="mb-4 text-[15px] font-semibold text-[#fafafa]">
                  {title}
                </h2>
              )}
              <div className="text-[13px] text-[#d4d4d8] whitespace-pre-wrap leading-relaxed">
                {content || (
                  <span className="text-[#5c5c5e]">暂无内容</span>
                )}
              </div>
            </div>
          )}

          {/* 改写结果提示 */}
          {rewriteResult && tab === "write" && (
            <div className="rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/10 px-4 py-2 text-xs text-[#5e6ad2]">
              已用「{rewriteResult.style_used || "默认"}」风格改写
            </div>
          )}

          {rewriteError && (
            <div className="rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-4 py-3 text-sm text-[#e5484d]">{rewriteError}</div>
          )}
          {scanError && (
            <div className="rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-4 py-3 text-sm text-[#e5484d]">{scanError}</div>
          )}

          {/* 操作栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRewrite}
              disabled={rewriting || !content.trim()}
              className="rounded-md bg-[#5e6ad2] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#6e7ae0] disabled:opacity-50 transition-colors"
            >
              {rewriting ? "改写中..." : "✨ AI改写"}
            </button>
            <button
              onClick={handleScan}
              disabled={scanning || !content.trim()}
              className="rounded-md border border-white/10 px-5 py-2.5 text-[13px] text-[#8a8a8e] hover:bg-white/5 hover:text-white disabled:opacity-50 transition-colors"
            >
              {scanning ? "扫描中..." : "🔍 AI扫描"}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md border border-[#34c759]/30 px-5 py-2.5 text-[13px] font-medium text-[#34c759] hover:bg-[#34c759]/10 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "💾 保存入库"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-md bg-[#34c759] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#3dd96c] disabled:opacity-50 transition-colors"
            >
              {publishing ? "发布中..." : "📤 发布草稿"}
            </button>
          </div>

          {actionMsg && (
            <div
              className={`rounded-md px-4 py-2 text-sm ${
                actionMsg.startsWith("✅")
                  ? "bg-[#34c759]/10 text-[#34c759]"
                  : "bg-[#e5484d]/10 text-[#e5484d]"
              }`}
            >
              {actionMsg}
            </div>
          )}
        </div>

        {/* 右侧：风格参考 */}
        <div className="space-y-4">
          <div className="rounded-lg border border-white/6 bg-[#1c1c1e] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#fafafa]">
              可用风格 ({styles.length})
            </h3>
            {styles.length === 0 ? (
              <p className="text-sm text-[#5c5c5e]">暂无风格</p>
            ) : (
              <div className="space-y-2">
                {styles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.name)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedStyle === s.name
                        ? "border-[#5e6ad2] bg-[#5e6ad2]/10"
                        : "border-white/6 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#fafafa]">
                        {s.name}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "ready"
                            ? "bg-[#34c759]/15 text-[#34c759]"
                            : "bg-[#f5a623]/15 text-[#f5a623]"
                        }`}
                      >
                        {s.status === "ready" ? "可用" : s.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8a8a8e] mt-1">
                      {s.source}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.features.slice(0, 2).map((f, i) => (
                        <span
                          key={i}
                          className="text-xs text-[#8a8a8e] bg-white/5 px-1.5 py-0.5 rounded"
                        >
                          {f.length > 15 ? f.slice(0, 15) + "..." : f}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
