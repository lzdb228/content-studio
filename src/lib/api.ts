/**
 * API 层 — 真实 API + mock 降级
 *
 * 真实 API: 248 服务器 FastAPI (:8893)
 * 开发模式: 直连 248（跨域需服务器 CORS 支持）
 * 部署模式: 同域（8889 前端 → 8893 API）
 */

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

/** 对标账号 */
export interface Account {
  id: string;
  name: string;
  identifier: string;
  track: string;
  status: string;
  shortName: string;
  collectEnabled?: boolean;
}

/** 微信搜索公众号结果 */
export interface WxAccountSearchResult {
  fakeid: string;
  nickname: string;
  signature: string;
  service_type: number;
}

// ── API Base ──────────────────────────────

/** 开发模式直连 248，部署模式同域 */
const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://47.98.184.248:8893"
  : "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${sep}_=${Date.now()}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json.data as T;
}

// ── 对标账号 API ─────────────────────────

export async function apiGetAccounts(): Promise<Account[]> {
  return fetchAPI<Account[]>("/api/accounts");
}

export async function apiCreateAccount(account: {
  name: string;
  identifier: string;
  track: string;
  status: string;
}): Promise<Account> {
  return fetchAPI<Account>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export async function apiDeleteAccount(recordId: string): Promise<void> {
  await fetchAPI<void>(`/api/accounts/${recordId}`, { method: "DELETE" });
}

export async function apiUpdateAccountStatus(
  recordId: string,
  status: string
): Promise<void> {
  await fetchAPI<void>(`/api/accounts/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function apiSearchAccounts(
  query: string,
  page = 1,
  pageSize = 5
): Promise<WxAccountSearchResult[]> {
  return fetchAPI<WxAccountSearchResult[]>(
    `/api/accounts/search?q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`
  );
}

// ── 风格卡 API ───────────────────────────

export interface StyleCard {
  id: string;
  name: string;
  source: string;
  featureCount: number;
  features: string[];
  status: string;
}

export async function apiGetStyles(): Promise<StyleCard[]> {
  const data = await fetchAPI<{ styles: StyleCard[] }>("/api/styles");
  return data.styles || [];
}

export async function apiDistill(accountName: string): Promise<{
  style?: StyleCard;
  message?: string;
}> {
  return fetchAPI("/api/styles/distill", {
    method: "POST",
    body: JSON.stringify({ account_name: accountName }),
  });
}

// ── 素材库 API ───────────────────────────

export async function apiGetLibrary(pageSize = 50): Promise<FeishuRecord[]> {
  return fetchAPI<FeishuRecord[]>(`/api/library?page_size=${pageSize}`);
}

// ── AI 改写 ──────────────────────────────

export interface RewriteResult {
  rewritten: string;
  style_used: string;
}

export async function apiRewrite(
  text: string,
  styleName = ""
): Promise<RewriteResult> {
  return fetchAPI<RewriteResult>("/api/rewrite", {
    method: "POST",
    body: JSON.stringify({ text, style_name: styleName }),
  });
}

// ── 去 AI 扫描 ───────────────────────────

export interface ScanScores {
  ai_traces: number;
  sentence_variety: number;
  personal_voice: number;
  repetition: number;
  interaction: number;
}

export interface ScanResult {
  scores: ScanScores;
  verdict: string;
  summary: string;
  stats: {
    char_count: number;
    sentence_count: number;
    avg_sentence_len: number;
    word_count: number;
  };
  total_score: number;
  max_score: number;
}

export async function apiScan(text: string): Promise<ScanResult> {
  return fetchAPI<ScanResult>("/api/scan", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ── 保存 ─────────────────────────────────

export async function apiSaveArticle(params: {
  title: string;
  content: string;
  source?: string;
  style?: string;
  link?: string;
  art_type?: string;
}): Promise<void> {
  await fetchAPI<void>("/api/library/save", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ── 发布 ─────────────────────────────────

export async function apiPublish(params: {
  title: string;
  content: string;
  account_name?: string;
}): Promise<void> {
  await fetchAPI<void>("/api/publish", {
    method: "POST",
    body: JSON.stringify({
      title: params.title,
      content: params.content,
      account_name: params.account_name || "网盘游戏网",
    }),
  });
}

export interface SyncResult {
  success: boolean;
  account_name: string;
  new_articles: number;
  updated_articles: number;
  filtered: number;
  deduped: number;
  error?: string;
  note?: string;
}

// ── 采集 API ─────────────────────────────

export async function apiSyncAll(
  beginDate = "",
  endDate = ""
): Promise<SyncResult[]> {
  const body: Record<string, string> = {};
  if (beginDate) body.begin_date = beginDate;
  if (endDate) body.end_date = endDate;
  return fetchAPI<SyncResult[]>("/api/sync", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── 设置 API ─────────────────────────────

export async function apiGetTables(): Promise<FeishuTable[]> {
  return fetchAPI<FeishuTable[]>("/api/tables");
}

// ── 配置管理 ─────────────────────────────

export interface ServerConfig {
  feishu: {
    app_id: string;
    app_secret: string;
    base_token: string;
  };
  wechat: {
    app_id: string;
    app_secret: string;
  };
  accounts_table_id: string;
  articles_table_id: string;
}

export async function apiGetConfig(): Promise<ServerConfig> {
  return fetchAPI<ServerConfig>("/api/config");
}

export async function apiSaveConfig(
  partial: Partial<ServerConfig>
): Promise<void> {
  await fetchAPI<void>("/api/config", {
    method: "POST",
    body: JSON.stringify(partial),
  });
}

// ── 登录 ────────────────────────────────

/** Mock 登录 — 待接入真实 Auth */
export async function apiLogin(username: string, password: string): Promise<void> {
  if (!username || !password) throw new Error("用户名和密码不能为空");
  // 宽松模式（后续接真实 Auth）
  const { useAuthStore } = await import("../stores");
  useAuthStore.getState().login(username, "mock-token");
}

// ── Sidecar ──────────────────────────────

export async function apiStartSidecar(): Promise<string> {
  return fetchAPI<string>("/api/sidecar/start", { method: "POST" });
}

// ── 存量兼容（供尚未迁移的页面使用）─────

/** @deprecated 请使用 apiGetAccounts() */
export async function apiGetRecords(_tableId: string, _pageSize = 50): Promise<FeishuRecord[]> {
  const accounts = await apiGetAccounts();
  type AccFields = Record<string, unknown>;
  return (accounts as Account[]).map((a) => ({
    id: a.id,
    fields: {
      公众号名称: a.name,
      账号标识: a.identifier,
      赛道: a.track,
      状态: a.status,
    } as AccFields,
  }));
}

// ── Tauri 标记 ────────────────────────────

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
