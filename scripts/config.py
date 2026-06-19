"""共享配置 — 优先读 server_config.json，其次环境变量。"""

import os, json

_cfg_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'server_config.json'
)
_cfg = {}
if os.path.exists(_cfg_path):
    try:
        _cfg = json.load(open(_cfg_path))
    except Exception:
        pass


def _f(key: str, env_var: str = "") -> str:
    """读取嵌套配置字段，如 'feishu.app_id'。
    优先级：server_config.json > 环境变量 > 空字符串。
    """
    parts = key.split('.')
    val = _cfg
    for p in parts:
        if isinstance(val, dict):
            val = val.get(p, {})
        else:
            val = {}
    if isinstance(val, str) and val:
        return val
    if env_var:
        return os.environ.get(env_var, "")
    return ""


# ─── 飞书 ───
FEISHU_APP_ID     = _f('feishu.app_id',     'FEISHU_APP_ID')
FEISHU_APP_SECRET = _f('feishu.app_secret',  'FEISHU_APP_SECRET')
FEISHU_BASE_TOKEN = _f('feishu.base_token',  'FEISHU_BASE_TOKEN')

# ─── DashScope AI ───
DASHSCOPE_KEY = _f('dashscope.api_key', 'DASHSCOPE_API_KEY')
