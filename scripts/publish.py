"""
微信公众号发布脚本。
纯脚本：从飞书多维表格读凭证 → 调微信草稿 API。
"""

import urllib.request
import urllib.error
import json
import re
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_BASE_TOKEN as BASE_TOKEN

# ─── 飞书 API ─────────────────────────────────

TABLE_ACCOUNTS = "tbl4WFWGMf8SrF8a"  # 我的公众号

_token_cache = {"token": "", "expires": 0}


def _feishu_token() -> str:
    import time
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires"] - 60:
        return _token_cache["token"]
    data = json.dumps({"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET}).encode()
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    _token_cache["token"] = d["tenant_access_token"]
    _token_cache["expires"] = now + d.get("expire", 7200)
    return _token_cache["token"]


def _feishu_api(method: str, path: str, body: dict | None = None) -> dict:
    token = _feishu_token()
    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{BASE_TOKEN}{path}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": e.read().decode()[:300]}


# ─── 读取公众号凭证 ──────────────────────────

def _get_account_credentials(account_name: str = "") -> dict:
    """从飞书「我的公众号」表读取 appid + appsecret。
    如果不指定 account_name，返回第一条启用的记录。
    """
    r = _feishu_api("GET", f"/tables/{TABLE_ACCOUNTS}/records?page_size=20")
    items = (r.get("data", {}) or {}).get("items", [])
    for item in items:
        fields = item.get("fields", {})
        name = str(fields.get("公众号名称", ""))
        enabled = fields.get("启用", False)
        appid = str(fields.get("AppID", "")).strip()
        appsecret = str(fields.get("AppSecret", "")).strip()

        if not appid or not appsecret:
            continue

        if account_name:
            if account_name in name:
                return {"appid": appid, "appsecret": appsecret, "name": name}
        elif enabled or not account_name:
            return {"appid": appid, "appsecret": appsecret, "name": name}

    return {}


# ─── 微信 API ─────────────────────────────────

def _get_wx_token(appid: str, appsecret: str) -> str:
    url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appid}&secret={appsecret}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    token = d.get("access_token", "")
    if not token:
        raise RuntimeError(f"获取 access_token 失败: {d.get('errmsg', d)}")
    return token


def _html_to_wx(content: str) -> str:
    """将纯文本/简单 HTML 转为微信支持的富文本格式。"""
    if re.search(r'<(p|div|section|h\d)', content, re.I):
        return content
    lines = content.strip().split("\n")
    return "".join(f"<p>{line.strip()}</p>" for line in lines if line.strip())


def _get_default_thumb_media_id(token: str) -> str:
    """获取默认封面图的 media_id。
    生成蓝色占位图上传到微信永久素材。
    """
    import struct, zlib, io

    # 生成 300x200 蓝色封面 PNG
    def _make_png(w, h, color):
        def _chunk(ct, data):
            c = ct + data
            crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
            return struct.pack('>I', len(data)) + c + crc
        header = b'\x89PNG\r\n\x1a\n'
        ihdr = _chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
        raw = b''
        for y in range(h):
            raw += b'\x00'
            for x in range(w):
                raw += bytes(color)
        idat = _chunk(b'IDAT', zlib.compress(raw))
        iend = _chunk(b'IEND', b'')
        return header + ihdr + idat + iend

    png = _make_png(300, 200, (59, 130, 246))

    boundary = '----wxcover123'
    body = io.BytesIO()
    body.write(f'--{boundary}\r\n'.encode())
    body.write('Content-Disposition: form-data; name="media"; filename="cover.png"\r\n'.encode())
    body.write('Content-Type: image/png\r\n\r\n'.encode())
    body.write(png)
    body.write(f'\r\n--{boundary}--\r\n'.encode())

    req = urllib.request.Request(
        f'https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={token}&type=image',
        data=body.getvalue(),
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST')
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read())
    return d.get('media_id', '')


def publish_draft(title: str, content: str, account_name: str = "网盘游戏网") -> dict:
    """发布草稿到微信公众号。

    参数:
        title: 文章标题
        content: 文章内容 (纯文本或 HTML)
        account_name: 公众号名称（从飞书多维表格匹配）

    返回: {ok, data: {media_id, message}} 或 {ok: false, error}
    """
    # 1. 从飞书读凭证
    creds = _get_account_credentials(account_name)
    if not creds:
        return {
            "ok": False,
            "error": f"未在飞书「我的公众号」表中找到「{account_name}」的有效凭证",
            "hint": "请确保表中已填写 AppID 和 AppSecret"
        }

    try:
        # 2. 获取微信 access_token
        token = _get_wx_token(creds["appid"], creds["appsecret"])

        # 3. 获取封面图 media_id
        thumb_id = _get_default_thumb_media_id(token)

        # 4. 构造草稿
        wx_content = _html_to_wx(content)
        draft = {
            "articles": [{
                "title": title,
                "author": "",
                "digest": content[:54].replace("\n", " ") if content else "",
                "content": wx_content,
                "content_source_url": "",
                "thumb_media_id": thumb_id,
                "need_open_comment": 0,
                "only_fans_can_comment": 0,
                "show_cover_pic": 0,
            }]
        }

        # 5. 调用草稿 API
        url = f"https://api.weixin.qq.com/cgi-bin/draft/add?access_token={token}"
        body = json.dumps(draft, ensure_ascii=False).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read())

        if d.get("media_id"):
            return {
                "ok": True,
                "data": {
                    "media_id": d["media_id"],
                    "message": f"草稿已保存到「{creds['name']}」微信公众号",
                    "account": creds["name"],
                }
            }
        else:
            return {"ok": False, "error": f"创建草稿失败: {d.get('errmsg', d)}"}

    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    import sys
    title = sys.argv[1] if len(sys.argv) > 1 else "测试发布"
    content = sys.argv[2] if len(sys.argv) > 2 else "这是通过内容工坊发布到微信公众号的测试文章。"
    account = sys.argv[3] if len(sys.argv) > 3 else "网盘游戏网"

    print(f"发布到「{account}」...")
    result = publish_draft(title, content, account)
    print(json.dumps(result, ensure_ascii=False, indent=2))
