"""
统一配置读写模块 — 优先读 server_config.json，其次环境变量。

支持所有配置项：飞书、微信、DashScope、表格 ID。
提供 get_config / set_config / reload_config 公共接口。
"""

import os, json, threading

# ─── 配置文件路径 ──────────────────────────────────────────────
CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "server_config.json",
)

_lock = threading.Lock()


def _load_config():
    """从文件加载配置字典。"""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_config(data: dict):
    """将配置字典写入文件。"""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─── 全局缓存 ──────────────────────────────────────────────────
_cfg = _load_config()


# ─── 公共 API ──────────────────────────────────────────────────

def get_config(key=None):
    """读取配置值。

    Args:
        key: 点分路径如 'feishu.app_id'；为 None 时返回完整字典（深拷贝）。

    Returns:
        配置值或整个字典；key 不存在时返回 None。
    """
    with _lock:
        if key is None:
            return json.loads(json.dumps(_cfg))
        parts = key.split(".")
        val = _cfg
        for p in parts:
            if isinstance(val, dict):
                val = val.get(p)
            else:
                return None
        return val


def set_config(key: str, value):
    """设置配置值并持久化到文件。

    Args:
        key: 点分路径如 'wechat.cookie'。
        value: 配置值（字符串/数字/字典等）。
    """
    with _lock:
        parts = key.split(".")
        current = _cfg
        for p in parts[:-1]:
            if p not in current or not isinstance(current[p], dict):
                current[p] = {}
            current = current[p]
        current[parts[-1]] = value
        _save_config(_cfg)


def reload_config():
    """重新从磁盘加载配置（用于外部修改后同步）。"""
    global _cfg
    with _lock:
        _cfg = _load_config()


# ─── 便捷访问器（向后兼容）───────────────────────────────────

def _f(key: str, env_var: str = "") -> str:
    """读取嵌套配置字段。

    优先级：server_config.json > 环境变量 > 空字符串。
    """
    val = get_config(key)
    if isinstance(val, str) and val:
        return val
    if env_var:
        val = os.environ.get(env_var, "")
        if val:
            return val
    return ""


# ─── 飞书 ──────────────────────────────────────────────────────
FEISHU_APP_ID     = _f("feishu.app_id",     "FEISHU_APP_ID")
FEISHU_APP_SECRET = _f("feishu.app_secret", "FEISHU_APP_SECRET")
FEISHU_BASE_TOKEN = _f("feishu.base_token", "FEISHU_BASE_TOKEN")

# ─── DashScope AI ─────────────────────────────────────────────
DASHSCOPE_KEY = _f("dashscope.api_key", "DASHSCOPE_API_KEY")

# ─── 微信采集 ──────────────────────────────────────────────────
WECHAT_COOKIE = _f("wechat.cookie", "WECHAT_COOKIE")
WECHAT_TOKEN  = _f("wechat.token",  "WECHAT_TOKEN")

# ─── 表格 ID ──────────────────────────────────────────────────
ACCOUNTS_TABLE_ID = _f("accounts_table_id", "ACCOUNTS_TABLE_ID")
ARTICLES_TABLE_ID = _f("articles_table_id", "ARTICLES_TABLE_ID")
