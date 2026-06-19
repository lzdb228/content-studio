"""
内容工坊 FastAPI Sidecar
桥接 wechat_crawl.py，封装为 REST API，供 Tauri Rust 后端调用。
"""
import subprocess, json, os, sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Content Studio Sidecar", version="0.1.0")

# Path to wechat_crawl.py
SKILL_DIR = Path("/xingliu-brain/config/agents/skills/collect/scripts")
CRAWL_SCRIPT = SKILL_DIR / "wechat_crawl.py"

# Content factory table IDs (defaults, override via env)
FEISHU_BASE_TOKEN = os.environ.get("FEISHU_BASE_TOKEN", "QW3Jbqm2QaS362s2Zk3cWVbQnlb")
ACCOUNT_TABLE_ID = os.environ.get("ACCOUNT_TABLE_ID", "tbloLzUPoKoBOHti")
ARTICLE_TABLE_ID = os.environ.get("ARTICLE_TABLE_ID", "tblQ9Jj095axnoQF")

class CollectResult(BaseModel):
    success: bool
    account_name: str
    new_articles: int = 0
    updated_articles: int = 0
    error: Optional[str] = None

@app.get("/api/health")
async def health():
    return {"status": "ok", "python": sys.version, "crawl_script": str(CRAWL_SCRIPT)}

@app.post("/api/collect/sync")
async def sync_all():
    """触发全部对标账号采集"""
    if not CRAWL_SCRIPT.exists():
        raise HTTPException(500, f"wechat_crawl.py 未找到: {CRAWL_SCRIPT}")

    try:
        result = subprocess.run(
            ["python3", str(CRAWL_SCRIPT), "sync-all"],
            capture_output=True, text=True, timeout=300,
            env={"FEISHU_BASE_TOKEN": FEISHU_BASE_TOKEN}
        )
        # Parse output for per-account results
        results = []
        for line in result.stdout.splitlines():
            if "✅" in line or "❌" in line:
                results.append(CollectResult(
                    success="✅" in line,
                    account_name=line[:80],
                    error=result.stderr[:200] if result.stderr else None
                ))
        if not results:
            results.append(CollectResult(
                success=result.returncode == 0,
                account_name="全部账号",
                error=result.stderr[:200] if result.stderr else None
            ))
        return results
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "采集超时（>5分钟）")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/collect/sync/{fakeid}")
async def sync_one(fakeid: str, count: int = 10):
    """触发单账号采集"""
    if not CRAWL_SCRIPT.exists():
        raise HTTPException(500, f"wechat_crawl.py 未找到: {CRAWL_SCRIPT}")

    try:
        result = subprocess.run(
            ["python3", str(CRAWL_SCRIPT), "articles", fakeid, str(count), "--sync-feishu"],
            capture_output=True, text=True, timeout=120,
            env={**os.environ, "FEISHU_BASE_TOKEN": FEISHU_BASE_TOKEN}
        )
        return {
            "success": result.returncode == 0,
            "fakeid": fakeid,
            "stdout": result.stdout[-500:],
            "error": result.stderr[:200] if result.stderr else None
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "采集超时（>2分钟）")
    except Exception as e:
        raise HTTPException(500, str(e))
