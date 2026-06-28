import { useState } from "react";
import { useSettingsStore } from "../stores";
import { apiGetTables, FeishuTable } from "../lib/api";

export default function SettingsPage() {
  const { feishu, setFeishu } = useSettingsStore();
  const [testing, setTesting] = useState(false);
  const [tables, setTables] = useState<FeishuTable[]>([]);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTest = async () => {
    if (!feishu.appId || !feishu.appSecret || !feishu.baseToken) {
      setStatus({ ok: false, msg: "请填写所有飞书配置字段" });
      return;
    }
    setTesting(true);
    setStatus(null);
    try {
      const data = await apiGetTables();
      setTables(data);
      setStatus({ ok: true, msg: `连接成功 · ${data.length} 张表` });
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "连接失败" });
    } finally {
      setTesting(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-2 text-[13px] text-white placeholder:text-[#5c5c5e] focus:border-[#5e6ad2] focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/20";

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-[15px] font-semibold text-[#fafafa]">设置</h1>
        <p className="mt-0.5 text-[12px] text-[#8a8a8e]">配置飞书连接和内容工厂</p>
      </div>

      <div className="max-w-[480px] space-y-5">
        {/* 飞书配置 */}
        <div className="rounded-lg border border-white/6 bg-[#1c1c1e] p-6">
          <h2 className="mb-4 text-[13px] font-semibold text-[#fafafa]">飞书 API 配置</h2>
          <div className="space-y-3.5">
            {[
              { label: "App ID", key: "appId" as const, placeholder: "cli_axxxxxxxxx", type: "text" },
              { label: "App Secret", key: "appSecret" as const, placeholder: "••••••••", type: "password" },
              { label: "内容工厂 Base Token", key: "baseToken" as const, placeholder: "QW3Jbqm2QaS362s2Zk3cWVbQnlb", type: "text", mono: true },
            ].map(({ label, key, placeholder, type, mono }) => (
              <div key={key}>
                <label className="mb-1 block text-[12px] font-medium text-[#8a8a8e]">{label}</label>
                <input
                  type={type}
                  value={feishu[key]}
                  onChange={(e) => setFeishu({ [key]: e.target.value })}
                  placeholder={placeholder}
                  className={`${inputClass} ${mono ? "font-mono text-[12px]" : ""}`}
                />
              </div>
            ))}
            <div>
              <button
                onClick={handleTest}
                disabled={testing}
                className="rounded-md bg-[#5e6ad2] px-5 py-2 text-[12px] font-medium text-white hover:bg-[#6e7ae0] transition-colors disabled:opacity-50"
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
            </div>
          </div>

          {status && (
            <div
              className={`mt-4 rounded-md px-4 py-3 text-[12px] ${
                status.ok
                  ? "border border-[#34c759]/30 bg-[#34c759]/10 text-[#34c759]"
                  : "border border-[#e5484d]/30 bg-[#e5484d]/10 text-[#e5484d]"
              }`}
            >
              {status.msg}
            </div>
          )}
        </div>

        {/* Tables */}
        {tables.length > 0 && (
          <div className="rounded-lg border border-white/6 bg-[#1c1c1e] p-6">
            <h2 className="mb-3 text-[13px] font-semibold text-[#fafafa]">检测到的数据表</h2>
            <div className="space-y-1.5">
              {tables.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-white/6 px-4 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-[#fafafa]">{t.name}</p>
                    <code className="text-[11px] text-[#5c5c5e]">{t.table_id}</code>
                  </div>
                  {t.name === "账号列表" && (
                    <span className="rounded bg-[#5e6ad2]/15 px-1.5 py-0.5 text-[11px] font-medium text-[#5e6ad2]">对标</span>
                  )}
                  {t.name === "文章列表" && (
                    <span className="rounded bg-[#34c759]/15 px-1.5 py-0.5 text-[11px] font-medium text-[#34c759]">素材库</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guide */}
        <div className="rounded-lg border border-white/6 bg-white/5 p-5">
          <h2 className="mb-2 text-[13px] font-semibold text-[#fafafa]">还没有内容工厂？</h2>
          <p className="mb-2 text-[12px] text-[#8a8a8e]">
            在飞书星核知识库中打开「微信公众号内容工厂」副本，复制到你的飞书空间。
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-[12px] text-[#8a8a8e]">
            <li>飞书打开星核知识库 → 微信公众号内容工厂 副本</li>
            <li>点击右上角「...」→ 复制到我的空间</li>
            <li>飞书开放平台创建应用，获取 App ID / App Secret</li>
            <li>将 Base Token 粘贴到上方配置</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
