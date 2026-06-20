"""配置管理路由 — 读/写 server_config.json"""

import os, json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# 复用 scripts/config.py 的配置路径（保持一致）
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server_config.json")


def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    return {}


def save_config(data: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _mask_secret(s: str) -> str:
    """脱敏：保留前 4 位和后 4 位，中间替换为 *。"""
    if not s or len(s) <= 8:
        return s[:4] + "****" if len(s) > 4 else "****"
    return s[:4] + "*" * (len(s) - 8) + s[-4:]


class ConfigSaveRequest(BaseModel):
    feishu: Optional[dict] = None
    wechat: Optional[dict] = None
    dashscope: Optional[dict] = None
    accounts_table_id: Optional[str] = None
    articles_table_id: Optional[str] = None


@router.get("/api/config")
def api_get_config():
    """获取当前配置（脱敏处理敏感字段）。"""
    cfg = load_config()
    safe = json.loads(json.dumps(cfg))

    # 脱敏规则
    mask_keys = {
        "feishu": ["app_secret"],
        "wechat": ["app_secret", "cookie", "token"],
        "dashscope": ["api_key"],
    }
    for section, keys in mask_keys.items():
        if section in safe and isinstance(safe[section], dict):
            for k in keys:
                if k in safe[section] and safe[section][k]:
                    safe[section][k] = _mask_secret(str(safe[section][k]))

    return {"ok": True, "data": safe}


@router.post("/api/config")
def api_save_config(req: ConfigSaveRequest):
    """保存配置（部分更新）。"""
    cfg = load_config()
    if req.feishu:
        cfg.setdefault("feishu", {}).update(req.feishu)
    if req.wechat:
        cfg.setdefault("wechat", {}).update(req.wechat)
    if req.dashscope:
        cfg.setdefault("dashscope", {}).update(req.dashscope)
    if req.accounts_table_id:
        cfg["accounts_table_id"] = req.accounts_table_id
    if req.articles_table_id:
        cfg["articles_table_id"] = req.articles_table_id
    save_config(cfg)
    return {"ok": True}
