import { useEffect, useState } from "react";
import { apiGetRecords, FeishuRecord } from "../lib/api";

export default function LibraryPage() {
  const [articles, setArticles] = useState<FeishuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<FeishuRecord | null>(null);
  const [search, setSearch] = useState("");
  const [artTypeFilter, setArtTypeFilter] = useState<"全部" | "原创创作" | "对标创作">("全部");

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
    if (typeof ts === "number") {
      return new Date(ts).toLocaleDateString("zh-CN");
    }
    return "";
  };

  const getArtType = (fields: Record<string, unknown>): string => {
    return String(getField(fields, "文章类型", ""));
  };

  const filtered = articles.filter((a) => {
    // 按文章类型筛选（XIN-105）
    if (artTypeFilter !== "全部") {
      if (getArtType(a.fields) !== artTypeFilter) return false;
    }
    if (!search) return true;
    const title = getTitle(a.fields).toLowerCase();
    const author = String(getField(a.fields, "公众号名称")).toLowerCase();
    return title.includes(search.toLowerCase()) || author.includes(search.toLowerCase());
  });

  const statusColor = (status: unknown): string => {
    const s = String(status);
    if (s === "已发布") return "bg-green-50 text-green-700";
    if (s === "写作中") return "bg-yellow-50 text-yellow-700";
    return "bg-gray-50 text-gray-600";
  };

  return (
    <div className="flex h-full">
      {/* List Panel */}
      <div className={`flex-1 overflow-auto p-8 ${selected ? "border-r border-gray-200" : ""}`}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">素材库</h1>
            <p className="mt-1 text-sm text-gray-500">
              {filtered.length}/{articles.length} 篇文章
              {artTypeFilter !== "全部" && ` · ${artTypeFilter}`}
            </p>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="搜索标题或公众号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none w-56"
            />
            <button
              onClick={loadArticles}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              🔄 刷新
            </button>
          </div>
        </div>

        {/* XIN-105: 文章类型筛选标签 */}
        <div className="mb-4 flex gap-2">
          {(["全部", "原创创作", "对标创作"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setArtTypeFilter(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                artTypeFilter === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {t === "全部" ? "📋 全部" : t === "原创创作" ? "✍️ 原创创作" : "🎯 对标创作"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-400">加载中...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((art) => (
              <button
                key={art.id}
                onClick={() => setSelected(art)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selected?.id === art.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p className="font-medium text-gray-900 line-clamp-2">{getTitle(art.fields)}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  {getArtType(art.fields) && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      getArtType(art.fields) === "对标创作" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {getArtType(art.fields) === "对标创作" ? "🎯" : "✍️"} {getArtType(art.fields)}
                    </span>
                  )}
                  <span>{String(getField(art.fields, "公众号名称"))}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(getField(art.fields, '状态'))}`}>
                    {String(getField(art.fields, "状态", "未知"))}
                  </span>
                  {Boolean(getField(art.fields, "发布时间")) && (
                    <span>{formatTime(getField(art.fields, "发布时间"))}</span>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                {search ? "无匹配文章" : "素材库为空，请先同步对标账号"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="w-96 overflow-auto bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">文章详情</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">标题</p>
              <p className="text-sm text-gray-900">{getTitle(selected.fields)}</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">公众号</p>
              <p className="text-sm text-gray-900">{String(getField(selected.fields, "公众号名称"))}</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">文章类型</p>
              <p className="text-sm text-gray-900">
                {getArtType(selected.fields) || "—"}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">赛道</p>
              <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {String(getField(selected.fields, "赛道", "未分类"))}
              </span>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">状态</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(getField(selected.fields, "状态"))}`}>
                {String(getField(selected.fields, "状态", "未知"))}
              </span>
            </div>

            {Boolean(getField(selected.fields, "发布时间")) && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">发布时间</p>
                <p className="text-sm text-gray-900">{formatTime(getField(selected.fields, "发布时间"))}</p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <a
                href={getUrl(selected.fields)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                🔗 查看原文
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
