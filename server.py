"""
内容工坊后端 — FastAPI 桥接层。
脚本为主、AI 为辅：数据读写走飞书多维表格，AI 调用走 DashScope。
"""

import json
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from scripts.bitable import get_styles, get_articles, save_article, add_style, get_accounts, create_account, delete_account, get_tables, update_account_status
from scripts.rewrite import ai_rewrite
from scripts.scan import ai_scan

app = FastAPI(title="微信公众号内容工厂 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request models ─────────────────────────────

class RewriteRequest(BaseModel):
    text: str
    style_name: str = ""

class ScanRequest(BaseModel):
    text: str

class SaveRequest(BaseModel):
    title: str
    content: str
    source: str = ""
    style: str = ""
    link: str = ""
    art_type: str = "原文"

class PublishRequest(BaseModel):
    title: str
    content: str
    account_name: str = "网盘游戏网"

class DistillRequest(BaseModel):
    account_name: str
    article_texts: Optional[List[str]] = None
    article_ids: Optional[List[str]] = None


# ─── 风格卡 ─────────────────────────────────────

@app.get("/api/styles")
def api_get_styles():
    return {"ok": True, "data": {"styles": get_styles()}}


class AddStyleRequest(BaseModel):
    name: str
    source: str = ""
    features: List[str] = []


@app.post("/api/styles")
def api_add_style(req: AddStyleRequest):
    """保存蒸馏后的风格卡到飞书多维表格。"""
    if not req.name.strip():
        raise HTTPException(400, "风格名称不能为空")
    if not req.features:
        raise HTTPException(400, "特征列表不能为空")
    ok = add_style(req.name.strip(), req.source.strip(), req.features)
    if ok:
        return {"ok": True}
    return {"ok": False, "error": "保存风格失败"}


@app.post("/api/styles/distill")
def api_distill(req: DistillRequest):
    """蒸馏风格（脚本统计 + AI 分析）。
    支持三种模式：
    1. 传入 article_texts → 直接分析指定文章
    2. 传入 article_ids → 从素材库提取对应文章
    3. 仅 account_name → 从素材库按账号名过滤（旧模式）
    """
    if not req.account_name.strip():
        raise HTTPException(400, "账号名不能为空")
    try:
        from scripts.distill import run_distill
        result = run_distill(
            req.account_name.strip(),
            article_texts=req.article_texts,
            article_ids=req.article_ids
        )
        if result.get("ok"):
            return {"ok": True, "data": result["data"]}
        else:
            return {"ok": False, "error": result.get("error", "蒸馏失败")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── 素材库 ─────────────────────────────────────

@app.get("/api/library")
def api_get_library():
    return {"ok": True, "data": get_articles()}


@app.post("/api/library/save")
def api_save(req: SaveRequest):
    ok = save_article(req.title, req.content, req.source, req.style, link=req.link, art_type=req.art_type)
    return {"ok": ok}


# ─── AI 改写 ────────────────────────────────────

@app.post("/api/rewrite")
def api_rewrite(req: RewriteRequest):
    if not req.text.strip():
        raise HTTPException(400, "文本不能为空")
    result = ai_rewrite(req.text, req.style_name)
    return {"ok": True, "data": result}


# ─── 去AI扫描 ──────────────────────────────────

@app.post("/api/scan")
def api_scan(req: ScanRequest):
    if not req.text.strip():
        raise HTTPException(400, "文本不能为空")
    result = ai_scan(req.text)
    return {"ok": True, "data": result}


# ─── 发布 ──────────────────────────────────────

@app.post("/api/publish")
def api_publish(req: PublishRequest):
    """发布到微信公众号草稿箱（从飞书多维表格读凭证）。"""
    import importlib, scripts.publish
    importlib.reload(scripts.publish)
    
    import threading
    result_holder = {}

    def _run():
        try:
            result_holder["result"] = scripts.publish.publish_draft(req.title, req.content, req.account_name)
        except Exception as e:
            result_holder["result"] = {"ok": False, "error": str(e)}

    t = threading.Thread(target=_run)
    t.start()
    t.join(timeout=25)
    if t.is_alive():
        return {"ok": False, "error": "发布超时"}
    return result_holder.get("result", {"ok": False, "error": "未知错误"})


class CreateAccountRequest(BaseModel):
    name: str
    identifier: str = ""
    track: str = ""
    status: str = "活跃"


# ─── 对标账号 ──────────────────────────────────

@app.get("/api/accounts")
def api_get_accounts():
    return {"ok": True, "data": get_accounts()}


@app.get("/api/accounts/search")
def api_search_accounts(q: str = "", page: int = 1, page_size: int = 5):
    """搜索微信公众号（调用 wechat_crawl.search_accounts）。"""
    if not q.strip():
        return {"ok": True, "data": []}
    from scripts.wechat_crawl import search_accounts
    begin = (page - 1) * page_size
    results = search_accounts(q.strip(), count=page_size, begin=begin)
    return {"ok": True, "data": results}


@app.post("/api/accounts")
def api_create_account(req: CreateAccountRequest):
    if not req.name.strip():
        raise HTTPException(400, "公众号名称不能为空")
    result = create_account(req.name.strip(), req.identifier.strip(), req.track.strip(), req.status)
    if result:
        return {"ok": True, "data": result}
    return {"ok": False, "error": "创建失败"}


@app.delete("/api/accounts/{record_id}")
def api_delete_account(record_id: str):
    """删除对标账号。"""
    ok = delete_account(record_id)
    if ok:
        return {"ok": True}
    raise HTTPException(500, "删除失败")
class UpdateAccountRequest(BaseModel):
    status: str = "活跃"


@app.patch("/api/accounts/{record_id}")
def api_update_account(record_id: str, req: UpdateAccountRequest):
    """更新对标账号状态（采集开关）。"""
    ok = update_account_status(record_id, req.status)
    if ok:
        return {"ok": True}
    raise HTTPException(500, "更新失败")


# ─── 文章拉取（蒸馏用）─────────────────────────

@app.get("/api/articles/fetch")
def api_fetch_articles(fakeid: str = "", count: int = 10):
    """通过 wechat_crawl 获取指定公众号最新文章（预览用）。"""
    if not fakeid.strip():
        raise HTTPException(400, "fakeid 不能为空")
    try:
        from scripts.wechat_crawl import get_articles
        articles = get_articles(fakeid.strip(), count=count)
        return {"ok": True, "data": articles}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── 表格列表 ──────────────────────────────────

@app.get("/api/tables")
def api_get_tables():
    return {"ok": True, "data": get_tables()}


# ─── 一键采集 ──────────────────────────────────

class SyncRequest(BaseModel):
    begin_date: str = ""
    end_date: str = ""


@app.post("/api/sync")
def api_sync(req: SyncRequest | None = None):
    """同步对标账号文章到素材库（使用 wechat_crawl.py）。
    可选参数 begin_date / end_date 日期筛选 (YYYY-MM-DD)。"""
    try:
        from scripts.sync_accounts import sync_all
        bd = req.begin_date if req else ""
        ed = req.end_date if req else ""
        results = sync_all(begin_date=bd, end_date=ed)
        return {"ok": True, "data": results}
    except Exception as e:
        return {"ok": False, "error": str(e), "hint": "可能需要先运行 python3 wechat_crawl.py auth 提取凭证"}


# ─── 配置管理 ──────────────────────────────────

import os
from config_routes import router as config_router
app.include_router(config_router)

# ─── 健康检查 ──────────────────────────────────

@app.get("/api/health")
def health():
    return {"ok": True, "service": "content-studio-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8893)
