import { useEffect, useState } from "react";
import { apiGetRecords, FeishuRecord } from "../lib/api";

export default function LibraryPage() {
  const [articles, setArticles] = useState<FeishuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<FeishuRecord | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    setError("");
    try {
      const records = await apiGetRecords("tblQ9Jj095axnoQF", 50);
      setArticles(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const getField = (fields: Record<string, unknown>, key: string, fallback: unknown = ""): unknown => {
    return fields[key] ?? fallback;
  };

  const getTitle = (fields: Record<string, unknown>): string => {
    const titleObj = getField(fields, "文章标题");
    if (typeof titleObj === "object" && titleObj !== null && "text" in (titleObj as Record<string, unknown>)) {
      return String((titleObj as Record<string, unknown>).text);
    }
    return String(titleObj || "无标题");
  };

  const getUrl = (fields: Record<string, unknown>): string => {
    const titleObj = getField(fields, "文章标题");
    if (typeof titleObj === "object" && titleObj !== null && "link" in (titleObj as Record<string, unknown>)) {
      return String((titleObj as Record<string, unknown>).link);
    }
    return "";
  };

  const formatTime = (ts: unknown): string => {
    if (typeof ts === "number") return new Date(ts).toLocaleDateString("zh-CN");
    return "";
  };

  const filtered = articles.filter((a) => {
    if (!search) return true;
    const title = getTitle(a.fields).toLowerCase();
    const author = String(getField(a.fields, "公众号名称")).toLowerCase();
    return title.includes(search.toLowerCase()) || author.includes(search.toLowerCase());
  });

  const statusBadge = (status: unknown) => {
    const s = String(status);
    if (s === "已发布") return "bg-[#34c759]/15 text-[#34c759]";
    if (s === "写作中") return "bg-[#f5a623]/15 text-[#f5a623]";
    return "bg-white/5 text-[#8a8a8e]";
  };

  const inputClass = "w-52 rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-1.5 text-[12px] text-white placeholder:text-[#5c5c5e] focus:border-[#5e6ad2] focus:outline-none";

  return (
    <div className="flex h-full overflow-hidden">
      {/* List panel */}
      <div className={`flex-1 overflow-auto p-8 ${selected ? "border-r border-white/6" : ""}`}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-[#fafafa]">素材库</h1>
            <p className="mt-0.5 text-[12px] text-[#8a8a8e]">{articles.length} 篇文章</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索标题或公众号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={loadArticles}
              className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[#8a8a8e] hover:bg-white/5 hover:text-white transition-colors"
            >
              刷新
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-[#e5484d]/30 bg-[#e5484d]/10 px-4 py-3 text-[12px] text-[#e5484d]">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-[13px] text-[#5c5c5e]">加载中...</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((art) => {
              const isActive = selected?.id === art.id;
              return (
                <button
                  key={art.id}
                  onClick={() => setSelected(art)}
                  className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "border-[#5e6ad2] bg-[#5e6ad2]/10"
                      : "border-white/6 bg-[#1c1c1e] hover:border-white/10"
                  }`}
                >
                  <p className="text-[13px] font-medium text-[#fafafa] line-clamp-2">{getTitle(art.fields)}</p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-[#8a8a8e]">
                    <span>{String(getField(art.fields, "公众号名称"))}</span>
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${statusBadge(getField(art.fields, "状态"))}`}>
                      {String(getField(art.fields, "状态", "未知"))}
                    </span>
                    {Boolean(getField(art.fields, "发布时间")) && (
                      <span>{formatTime(getField(art.fields, "发布时间"))}</span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-[13px] text-[#5c5c5e]">
                {search ? "无匹配文章" : "素材库为空"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-[340px] flex-shrink-0 overflow-auto bg-[#1c1c1e] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#fafafa]">文章详情</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-[#8a8a8e] hover:text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {[
              { label: "标题", value: getTitle(selected.fields) },
              { label: "公众号", value: String(getField(selected.fields, "公众号名称")) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="mb-0.5 text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">{label}</p>
                <p className="text-[13px] text-[#fafafa]">{value}</p>
              </div>
            ))}

            <div>
              <p className="mb-0.5 text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">赛道</p>
              <span className="inline-flex rounded-full bg-[#5e6ad2]/15 px-2 py-0.5 text-[11px] font-medium text-[#5e6ad2]">
                {String(getField(selected.fields, "赛道", "未分类"))}
              </span>
            </div>

            <div>
              <p className="mb-0.5 text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">状态</p>
              <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${statusBadge(getField(selected.fields, "状态"))}`}>
                {String(getField(selected.fields, "状态", "未知"))}
              </span>
            </div>

            {Boolean(getField(selected.fields, "发布时间")) && (
              <div>
                <p className="mb-0.5 text-[11px] font-medium text-[#8a8a8e] uppercase tracking-wide">发布时间</p>
                <p className="text-[13px] text-[#fafafa]">{formatTime(getField(selected.fields, "发布时间"))}</p>
              </div>
            )}

            <div className="border-t border-white/6 pt-4">
              <a
                href={getUrl(selected.fields)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-[#5e6ad2] hover:border-[#5e6ad2] transition-colors"
              >
                查看原文
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
