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
  // 编辑模式
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [artType, setArtType] = useState("原创创作"); // 对标创作 | 原创创作
  const [benchmarkAccount, setBenchmarkAccount] = useState(""); // XIN-108: 对标账号关联

  // 风格列表
  const [styles, setStyles] = useState<StyleCard[]>([]);

  // 对标账号列表
  const [accounts, setAccounts] = useState<Account[]>([]);

  // 改写
  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [rewriteError, setRewriteError] = useState("");

  // 扫描
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");

  // 保存 / 发布
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // 标签页
  const [tab, setTab] = useState<Tab>("write");

  // ── 加载风格 + 对标账号 ──────────────

  useEffect(() => {
    apiGetStyles().then(setStyles).catch(() => {});
    apiGetAccounts().then(setAccounts).catch(() => {});
  }, []);

  // ── AI 改写 ────────────────────────────

  const handleRewrite = async () => {
    if (!content.trim()) return;
    setRewriting(true);
    setRewriteError("");
    setRewriteResult(null);
    setTab("write");
    try {
      const result = await apiRewrite(content, selectedStyle);
      setRewriteResult(result);
      // 将改写结果填入编辑器
      setContent(result.rewritten);
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : "改写失败");
    } finally {
      setRewriting(false);
    }
  };

  // ── AI 扫描 ────────────────────────────

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

  // ── 保存 ──────────────────────────────

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

  // ── 发布 ──────────────────────────────

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

  // ── 渲染扫描可视化 ────────────────────

  const scoreBar = (label: string, score: number, max = 5) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score <= 2 ? "bg-green-400" : score <= 3 ? "bg-yellow-400" : "bg-red-400"
          }`}
          style={{ width: `${(score / max) * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 w-4 text-right">{score}</span>
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">创作工坊</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI 改写 + 去AI扫描 + 保存入库 + 一键发布
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：编辑区 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 文章类型选择器 —— XIN-107: 卡片式 */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex gap-3">
              {/* 原创创作 */}
              <button
                onClick={() => { setArtType("原创创作"); setBenchmarkAccount(""); }}
                className={`rounded-xl border-2 p-4 text-left w-44 transition-all ${
                  artType === "原创创作"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="text-2xl mb-1">✍️</div>
                <p className="text-sm font-semibold text-gray-900">原创创作</p>
                <p className="text-xs text-gray-400 mt-1">独立创作新文章，可选择风格模板辅助</p>
              </button>

              {/* 对标创作 */}
              <button
                onClick={() => setArtType("对标创作")}
                className={`rounded-xl border-2 p-4 text-left w-44 transition-all ${
                  artType === "对标创作"
                    ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="text-2xl mb-1">🎯</div>
                <p className="text-sm font-semibold text-gray-900">对标创作</p>
                <p className="text-xs text-gray-400 mt-1">参考对标账号风格进行仿写创作</p>
              </button>
            </div>

            {/* XIN-108: 对标账号关联选择器 */}
            {artType === "对标创作" && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  对标账号
                </label>
                <select
                  value={benchmarkAccount}
                  onChange={(e) => setBenchmarkAccount(e.target.value)}
                  className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
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
                  <p className="mt-1 text-xs text-orange-500">
                    🎯 将以「{benchmarkAccount}」的风格为对标参考进行创作
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 风格选择 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">风格模板：</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none flex-1"
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
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />

          {/* 标签切换 */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {([
              ["write", "✏️ 编辑"],
              ["scan", "🔍 扫描结果"],
              ["preview", "👁 预览"],
            ] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                  tab === k
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 编辑 / 扫描 / 预览 */}
          {tab === "write" && (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此输入或粘贴文章内容..."
              rows={14}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm leading-relaxed focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-y"
            />
          )}

          {tab === "scan" && scanResult && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  去AI扫描报告
                </h3>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    scanResult.total_score <= 15
                      ? "bg-green-50 text-green-600"
                      : scanResult.total_score <= 22
                      ? "bg-yellow-50 text-yellow-600"
                      : "bg-red-50 text-red-600"
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

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  {scanResult.summary}
                </p>
              </div>

              <div className="flex gap-4 text-xs text-gray-400">
                <span>字数：{scanResult.stats.char_count}</span>
                <span>句数：{scanResult.stats.sentence_count}</span>
                <span>均句长：{scanResult.stats.avg_sentence_len.toFixed(1)}</span>
              </div>
            </div>
          )}

          {tab === "scan" && !scanResult && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
              尚未扫描，请先点击「🔍 AI扫描」
            </div>
          )}

          {tab === "preview" && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              {title && (
                <h2 className="mb-4 text-xl font-bold text-gray-900">
                  {title}
                </h2>
              )}
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                {content || (
                  <span className="text-gray-400">暂无内容</span>
                )}
              </div>
            </div>
          )}

          {/* 改写结果 */}
          {rewriteResult && tab === "write" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
              已用「{rewriteResult.style_used || "默认"}」风格改写
            </div>
          )}

          {/* 错误信息 */}
          {rewriteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {rewriteError}
            </div>
          )}
          {scanError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {scanError}
            </div>
          )}

          {/* 操作栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRewrite}
              disabled={rewriting || !content.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {rewriting ? "改写中..." : "✨ AI改写"}
            </button>
            <button
              onClick={handleScan}
              disabled={scanning || !content.trim()}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {scanning ? "扫描中..." : "🔍 AI扫描"}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg border border-green-300 px-5 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 transition"
            >
              {saving ? "保存中..." : "💾 保存入库"}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
            >
              {publishing ? "发布中..." : "📤 发布草稿"}
            </button>
          </div>

          {/* 反馈信息 */}
          {actionMsg && (
            <div
              className={`rounded-lg px-4 py-2 text-sm ${
                actionMsg.startsWith("✅")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {actionMsg}
            </div>
          )}
        </div>

        {/* 右侧：风格参考 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              可用风格 ({styles.length})
            </h3>
            {styles.length === 0 ? (
              <p className="text-sm text-gray-400">暂无风格</p>
            ) : (
              <div className="space-y-2">
                {styles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.name)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedStyle === s.name
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
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
                    <p className="text-xs text-gray-400 mt-1">
                      {s.source}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.features.slice(0, 2).map((f, i) => (
                        <span
                          key={i}
                          className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded"
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
