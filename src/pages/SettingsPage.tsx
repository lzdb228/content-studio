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
      setStatus({ ok: true, msg: `连接成功！检测到 ${data.length} 张表` });
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "连接失败" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="mt-1 text-sm text-gray-500">配置飞书连接和内容工厂</p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* 飞书 API 配置 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">飞书 API 配置</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">App ID</label>
              <input
                type="text"
                value={feishu.appId}
                onChange={(e) => setFeishu({ appId: e.target.value })}
                placeholder="cli_axxxxxxxxx"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">App Secret</label>
              <input
                type="password"
                value={feishu.appSecret}
                onChange={(e) => setFeishu({ appSecret: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">内容工厂 Base Token</label>
              <input
                type="text"
                value={feishu.baseToken}
                onChange={(e) => setFeishu({ baseToken: e.target.value })}
                placeholder="QW3Jbqm2QaS362s2Zk3cWVbQnlb"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">
                在飞书打开「微信公众号内容工厂」→ 复制 Base URL 中的 token
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={testing}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
            </div>
          </div>

          {status && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                status.ok
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {status.msg}
            </div>
          )}
        </div>

        {/* 检测到的表 */}
        {tables.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">检测到的数据表</h2>
            <div className="space-y-2">
              {tables.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs font-mono text-gray-400">{t.table_id}</p>
                  </div>
                  {t.name === "账号列表" && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">对标管理</span>
                  )}
                  {t.name === "文章列表" && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">素材库</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 模板导入引导 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-2 text-lg font-semibold text-blue-900">还没有内容工厂？</h2>
          <p className="mb-4 text-sm text-blue-700">
            在飞书星核知识库中打开「微信公众号内容工厂」副本，复制到你的飞书空间，即可获得专属 Base Token。
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-700">
            <li>飞书打开星核知识库 → 微信公众号内容工厂 副本</li>
            <li>点击右上角「...」→ 复制到我的空间</li>
            <li>在飞书开放平台创建应用，获取 App ID / App Secret</li>
            <li>将 Base Token 粘贴到上方配置</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
