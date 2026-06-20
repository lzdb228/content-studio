"""
飞书多维表格读写 — 直调 Open API（不依赖 lark-cli）。
"""

import os, json, time, urllib.request, urllib.error
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import FEISHU_APP_ID as APP_ID, FEISHU_APP_SECRET as APP_SECRET, FEISHU_BASE_TOKEN as BASE_TOKEN

# 表格 ID 也从 config 读取（回退硬编码）
from config import _cfg
TABLE_STYLES   = 'tbls8pfJaC8Wzc2r'     # 风格卡
TABLE_ARTICLES = _cfg.get('articles_table_id') or 'tblQ9Jj095axnoQF'   # 文章列表
TABLE_ACCOUNTS = _cfg.get('accounts_table_id') or 'tbloLzUPoKoBOHti'   # 对标账号

# ─── Auth ──────────────────────────────────────
_token_cache = {"token": "", "expires": 0}

def _get_token() -> str:
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires"] - 60:
        return _token_cache["token"]

    data = json.dumps({
        "app_id": APP_ID,
        "app_secret": APP_SECRET,
    }).encode()
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    token = d.get("tenant_access_token", "")
    expire = d.get("expire", 7200)
    _token_cache["token"] = token
    _token_cache["expires"] = now + expire
    return token


def _api(method: str, path: str, body: dict | None = None) -> dict:
    """通用飞书 API 调用。"""
    token = _get_token()
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{BASE_TOKEN}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": e.read().decode()[:300]}


# ─── 风格卡 ────────────────────────────────────

def get_styles() -> list[dict]:
    """获取所有风格卡。"""
    r = _api("GET", f"/tables/{TABLE_STYLES}/records?page_size=50")
    items = (r.get("data", {}) or {}).get("items", [])
    styles = []
    for item in items:
        fields = item.get("fields", {})
        name = fields.get("名称", "")
        features_raw = fields.get("特征列表", "")
        source = fields.get("来源", name)
        status_raw = fields.get("状态", "就绪")
        count = fields.get("特征数", 0)
        status = "distilling" if "蒸馏" in str(status_raw) else "ready"
        if isinstance(features_raw, str):
            features = [f.strip() for f in features_raw.split("\n") if f.strip()]
        elif isinstance(features_raw, list):
            features = features_raw
        else:
            features = []
        styles.append({
            "id": f"style-{name}",
            "name": name,
            "source": source or name,
            "featureCount": int(count) if count else len(features),
            "features": features,
            "status": status,
        })
    return styles


def add_style(name: str, source: str, features: list[str]) -> bool:
    """创建风格卡。"""
    r = _api("POST", f"/tables/{TABLE_STYLES}/records", {
        "fields": {"采集状态": "活跃", 
            "名称": name,
            "来源": source,
            "特征列表": "\n".join(features),
            "特征数": len(features),
            "状态": "就绪",
        }
    })
    return "record" in (r.get("data", {}) or {})


# ─── 素材库 ────────────────────────────────────

def get_articles() -> list[dict]:
    """获取文章列表（自动翻页）。"""
    articles = []
    page_token = None
    while True:
        path = f"/tables/{TABLE_ARTICLES}/records?page_size=100"
        if page_token:
            path += f"&page_token={page_token}"
        r = _api("GET", path)
        items = (r.get("data", {}) or {}).get("items", [])
        for item in items:
            fields = item.get("fields", {})
            title = fields.get("文章标题", "")
            content = fields.get("文章内容", "")
            source = fields.get("账号名称", "")
            summary = fields.get("文章摘要", "")
            url = fields.get("发布链接", "")
            if isinstance(title, dict):
                title = title.get("text", title.get("link", ""))
            if isinstance(content, dict):
                content = content.get("text", "")
            articles.append({
                "id": item.get("record_id", f"art-{len(articles)}"),
                "title": str(title or "")[:100] or "(无标题)",
                "source": str(source or ""),
                "summary": str(summary or "") or (str(content)[:100] if content else ""),
                "content": str(content or ""),
                "url": str(url or ""),
            })
        if not (r.get("data", {}).get("has_more")):
            break
        page_token = r["data"]["page_token"]
    return articles


def save_article(title: str, content: str, source: str, style: str = "", link: str = "", art_type: str = "") -> bool:
    """保存文章到素材库。"""
    # 飞书「文章标题」是 URL/Link 字段，需传 Link 对象
    title_field = {"text": title[:100] if title else "(无标题)", "link": link or ""}

    fields = {
        "文章标题": title_field,
        "文章内容": content[:5000] if content else "",
        "文章摘要": content[:200] if content else "",
        "账号名称": source if source else "",
    }
    if link:
        fields["发布链接"] = link
    if style:
        fields["关联风格"] = style
    if art_type:
        fields["文章类型"] = art_type

    r = _api("POST", f"/tables/{TABLE_ARTICLES}/records", {"fields": fields})
    return "record" in (r.get("data", {}) or {})


# ─── 对标账号 ──────────────────────────────────

def get_accounts() -> list[dict]:
    """获取对标账号列表。"""
    r = _api("GET", f"/tables/{TABLE_ACCOUNTS}/records?page_size=50")

    items = (r.get("data", {}) or {}).get("items", [])
    accounts = []
    for item in items:
        fields = item.get("fields", {})
        name = fields.get("账号名称", "")
        if not name:
            continue
        identifier = fields.get("账号标识", "")
        acct_type = fields.get("账号类型", "")
        short_name = fields.get("账号简称", "")
        accounts.append({
            "id": item.get("record_id", ""),
            "name": str(name or ""),
            "identifier": str(identifier or ""),
            "track": str(acct_type or ""),
            "status": str(fields.get("采集状态","活跃") or "活跃"),
            "shortName": str(short_name or ""),
        })
    return accounts


def create_account(name: str, identifier: str, track: str, status: str = "活跃") -> dict | None:
    """创建对标账号。"""
    r = _api("POST", f"/tables/{TABLE_ACCOUNTS}/records", {
        "fields": {
            "采集状态": status,
            "账号名称": name,
            "账号标识": identifier,
            "账号类型": track,
        }
    })
    record = (r.get("data", {}) or {}).get("record", {})
    if not record:
        return None
    fields = record.get("fields", {})
    return {
        "id": record.get("record_id", ""),
        "name": str(fields.get("账号名称", "") or ""),
        "identifier": str(fields.get("账号标识", "") or ""),
        "track": str(fields.get("账号类型", "") or ""),
        "status": str(fields.get("采集状态","活跃") or "活跃"),
    }


def delete_account(record_id: str) -> bool:
    """删除对标账号。"""
    r = _api("DELETE", f"/tables/{TABLE_ACCOUNTS}/records/{record_id}")

    return r.get("code") == 0


def get_tables() -> list[dict]:
    """获取多维表格列表。"""
    r = _api("GET", "/tables")
    items = (r.get("data", {}) or {}).get("items", [])
    return [{"name": t.get("name", ""), "table_id": t.get("table_id", "")} for t in items]


# ─── CLI test ───────────────────────────────────

if __name__ == "__main__":
    styles = get_styles()
    print(f"风格卡: {len(styles)} 条")
    for s in styles:
        print(f"  {s['name']} ({s['featureCount']}特征) [{s['status']}]")

    articles = get_articles()
    print(f"素材库: {len(articles)} 条")
    for a in articles[:3]:
        print(f"  {a['title'][:40]} | {a['source']}")

def update_account_status(record_id: str, status: str) -> bool:
    """更新对标账号状态（采集开关）。status: '活跃'|'停更'"""
    r = _api("PUT", f"/tables/{TABLE_ACCOUNTS}/records/{record_id}", body={
        "fields": {"采集状态": status}
    })
    return r.get("code") == 0
