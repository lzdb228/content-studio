"""配置管理路由 — 读/写 server_config.json"""

import os, json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server_config.json")

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}

def save_config(data: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class ConfigSaveRequest(BaseModel):
    feishu: Optional[dict] = None
    wechat: Optional[dict] = None
    accounts_table_id: Optional[str] = None
    articles_table_id: Optional[str] = None


@router.get("/api/config")
def api_get_config():
    """获取当前配置（脱敏处理密码字段）。"""
    cfg = load_config()
    safe = json.loads(json.dumps(cfg))
    for section in ["feishu", "wechat"]:
        if section in safe and "app_secret" in safe[section]:
            s = safe[section]["app_secret"]
            if len(s) > 4:
                safe[section]["app_secret"] = s[:4] + "*" * (len(s) - 8) + s[-4:]
    return {"ok": True, "data": safe}


@router.post("/api/config")
def api_save_config(req: ConfigSaveRequest):
    """保存配置（部分更新）。"""
    cfg = load_config()
    if req.feishu:
        cfg.setdefault("feishu", {}).update(req.feishu)
    if req.wechat:
        cfg.setdefault("wechat", {}).update(req.wechat)
    if req.accounts_table_id:
        cfg["accounts_table_id"] = req.accounts_table_id
    if req.articles_table_id:
        cfg["articles_table_id"] = req.articles_table_id
    save_config(cfg)
    return {"ok": True}
