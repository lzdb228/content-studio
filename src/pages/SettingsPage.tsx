import { useEffect, useState } from "react";
import { apiGetConfig, apiSaveConfig, apiGetTables, FeishuTable } from "../lib/api";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feishu, setFeishu] = useState({ app_id: "", app_secret: "", base_token: "" });
  const [wechat, setWechat] = useState({ app_id: "", app_secret: "" });
  const [accountsTable, setAccountsTable] = useState("");
  const [articlesTable, setArticlesTable] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── 测试连接 ──
  const [testing, setTesting] = useState(false);
  const [tables, setTables] = useState<FeishuTable[]>([]);

  // 加载服务端配置
  useEffect(() => {
    (async () => {
      try {
        const cfg = await apiGetConfig();
        setFeishu({
          app_id: cfg.feishu.app_id,
          app_secret: cfg.feishu.app_secret,
          base_token: cfg.feishu.base_token,
        });
        setWechat({
          app_id: cfg.wechat.app_id,
          app_secret: cfg.wechat.app_secret,
        });
        setAccountsTable(cfg.accounts_table_id);
        setArticlesTable(cfg.articles_table_id);
      } catch (e) {
        setStatus({ ok: false, msg: "加载配置失败: " + (e instanceof Error ? e.message : String(e)) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await apiSaveConfig({
        feishu: {
          app_id: feishu.app_id,
          app_secret: feishu.app_secret,
          base_token: feishu.base_token,
        },
        wechat: {
          app_id: wechat.app_id,
          app_secret: wechat.app_secret,
        },
        accounts_table_id: accountsTable,
        articles_table_id: articlesTable,
      });
      setStatus({ ok: true, msg: "配置已保存" });
    } catch (e) {
      setStatus({ ok: false, msg: "保存失败: " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        加载配置中...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="mt-1 text-sm text-gray-500">配置飞书连接和内容工厂</p>
      </div>

      {/* 状态提示 */}
      {status && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            status.ok
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {status.ok ? "✅ " : "❌ "}
          {status.msg}
        </div>
      )}

      <div className="space-y-6">
        {/* 飞书 API 配置 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">飞书 API 配置</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">App ID</label>
              <input
                type="text"
                value={feishu.app_id}
                onChange={(e) => setFeishu({ ...feishu, app_id: e.target.value })}
                placeholder="cli_axxxxxxxxx"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">App Secret</label>
              <input
                type="password"
                value={feishu.app_secret}
                onChange={(e) => setFeishu({ ...feishu, app_secret: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">内容工厂 Base Token</label>
              <input
                type="text"
                value={feishu.base_token}
                onChange={(e) => setFeishu({ ...feishu, base_token: e.target.value })}
                placeholder="QW3Jbqm2QaS362s2Zk3cWVbQnlb"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleTest}
                disabled={testing}
                className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? "测试中..." : "🔗 测试连接"}
              </button>
              {tables.length > 0 && (
                <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600">
                  {tables.map((t) => (
                    <option key={t.table_id} value={t.table_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* 微信公众号配置 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">微信公众号配置</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">App ID</label>
              <input
                type="text"
                value={wechat.app_id}
                onChange={(e) => setWechat({ ...wechat, app_id: e.target.value })}
                placeholder="wx0000000000000000"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">App Secret</label>
              <input
                type="password"
                value={wechat.app_secret}
                onChange={(e) => setWechat({ ...wechat, app_secret: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 多维表格配置 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">多维表格 ID</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">对标账号表</label>
              <input
                type="text"
                value={accountsTable}
                onChange={(e) => setAccountsTable(e.target.value)}
                placeholder="tbloLzUPoKoBOHti"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">素材库/文章表</label>
              <input
                type="text"
                value={articlesTable}
                onChange={(e) => setArticlesTable(e.target.value)}
                placeholder="tblQ9Jj095axnoQF"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "💾 保存配置"}
          </button>
        </div>
      </div>
    </div>
  );
}
