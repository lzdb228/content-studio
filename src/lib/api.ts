/**
 * API 桥接层 — 统一封装 Tauri invoke，开发模式降级为 mock
 */
import { useAuthStore, useSettingsStore } from "../stores";

// ── 类型 ──────────────────────────────────

export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface FeishuTable {
  name: string;
  table_id: string;
}

export interface FeishuRecord {
  id: string;
  fields: Record<string, unknown>;
}

export interface CollectResult {
  success: boolean;
  account_name: string;
  new_articles: number;
  updated_articles: number;
  error?: string;
}

// ── Tauri invoke wrapper ───────────────────

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // 开发模式 mock
  return mockInvoke<T>(cmd, args);
}

// ── Mock 实现 ──────────────────────────────

function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

const mockAccounts = [
  { id: "rec001", fields: { 公众号名称: "AI工具派", 账号标识: "fake_ai_tools", 赛道: "AI工具", 状态: "活跃" } },
  { id: "rec002", fields: { 公众号名称: "副业有道", 账号标识: "fake_fuye", 赛道: "副业", 状态: "活跃" } },
  { id: "rec003", fields: { 公众号名称: "网盘游戏网", 账号标识: "fake_wp", 赛道: "网盘", 状态: "活跃" } },
];

const mockArticles: FeishuRecord[] = [
  { id: "art001", fields: { 文章标题: { link: "https://mp.weixin.qq.com/s/abc", text: "2026年AI工具大盘点" }, 公众号名称: "AI工具派", 发布时间: 1750291200000, 状态: "待选题", 赛道: "AI工具" } },
  { id: "art002", fields: { 文章标题: { link: "https://mp.weixin.qq.com/s/def", text: "副业月入过万的三个方法" }, 公众号名称: "副业有道", 发布时间: 1750204800000, 状态: "待选题", 赛道: "副业" } },
  { id: "art003", fields: { 文章标题: { link: "https://mp.weixin.qq.com/s/ghi", text: "网盘资源分享指南" }, 公众号名称: "网盘游戏网", 发布时间: 1750118400000, 状态: "写作中", 赛道: "网盘" } },
  { id: "art004", fields: { 文章标题: { link: "https://mp.weixin.qq.com/s/jkl", text: "Claude Code 实战技巧" }, 公众号名称: "AI工具派", 发布时间: 1750032000000, 状态: "待选题", 赛道: "AI工具" } },
  { id: "art005", fields: { 文章标题: { link: "https://mp.weixin.qq.com/s/mno", text: "如何用 Tauri 开发桌面应用" }, 公众号名称: "AI工具派", 发布时间: 1749945600000, 状态: "已发布", 赛道: "AI工具" } },
];

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await delay();

  switch (cmd) {
    case "login": {
      const { username, password } = args as unknown as LoginRequest;
      if (username && password) {
        return {
          access_token: "mock_token_" + Date.now(),
          refresh_token: "mock_refresh",
          expires_in: 7200,
        } as T;
      }
      throw new Error("用户名或密码错误");
    }

    case "get_feishu_tables": {
      return [
        { name: "账号列表", table_id: "tbloLzUPoKoBOHti" },
        { name: "文章列表", table_id: "tblQ9Jj095axnoQF" },
        { name: "对标创作管理", table_id: "tblLkobfuLIPL9zb" },
        { name: "原创创作管理", table_id: "tblsvjn3XfcCQvpw" },
        { name: "发布计划", table_id: "tbl6hshjwvpkYrxa" },
        { name: "我的公众号", table_id: "tbl4WFWGMf8SrF8a" },
      ] as T;
    }

    case "get_feishu_records": {
      const { table_id } = args as { table_id: string };
      if (table_id === "tbloLzUPoKoBOHti") return mockAccounts as T;
      if (table_id === "tblQ9Jj095axnoQF") return mockArticles as T;
      return [] as T;
    }

    case "sync_all_accounts": {
      await delay(1500);
      return [
        { success: true, account_name: "AI工具派", new_articles: 3, updated_articles: 1 },
        { success: true, account_name: "副业有道", new_articles: 2, updated_articles: 0 },
        { success: true, account_name: "网盘游戏网", new_articles: 5, updated_articles: 2 },
      ] as T;
    }

    case "start_sidecar": {
      return "Sidecar 已启动 (mock)" as T;
    }

    case "store_secret":
    case "get_secret": {
      return null as T;
    }

    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

// ── 公开 API ───────────────────────────────

export async function apiLogin(username: string, password: string): Promise<void> {
  const token = await invoke<AuthToken>("login", { username, password });
  useAuthStore.getState().login(username, token.access_token);
}

export async function apiGetTables(): Promise<FeishuTable[]> {
  const { feishu } = useSettingsStore.getState();
  return invoke<FeishuTable[]>("get_feishu_tables", {
    appId: feishu.appId,
    appSecret: feishu.appSecret,
    baseToken: feishu.baseToken,
  });
}

export async function apiGetRecords(tableId: string, pageSize = 50): Promise<FeishuRecord[]> {
  const { feishu } = useSettingsStore.getState();
  return invoke<FeishuRecord[]>("get_feishu_records", {
    appId: feishu.appId,
    appSecret: feishu.appSecret,
    baseToken: feishu.baseToken,
    tableId,
    pageSize,
  });
}

export async function apiSyncAll(): Promise<CollectResult[]> {
  return invoke<CollectResult[]>("sync_all_accounts");
}

export async function apiStartSidecar(): Promise<string> {
  return invoke<string>("start_sidecar");
}

export { isTauri };
