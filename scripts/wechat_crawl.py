#!/usr/bin/env python3
"""
微信公众号采集工具集。

用法：
  python3 wechat_crawl.py search <关键词>          # 搜索公众号
  python3 wechat_crawl.py articles <fakeid> [数量]  # 获取文章列表
  python3 wechat_crawl.py content <url> [输出目录]   # 下载文章+图片→Markdown

首次使用需先提取 token 和 cookie：
  python3 wechat_crawl.py auth                       # 从 Chrome 提取
"""

import sys
import json
import random
import time
import os
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

# ── User-Agent 轮换池 ──────────────────────────────────────────
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 Chrome/45.0.2454.85 Safari/537.36 115Browser/6.0.3',
    'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us) AppleWebKit/534.50 Version/5.1 Safari/534.50',
    'Mozilla/5.0 (Windows NT 6.1; rv:2.0.1) Gecko/20100101 Firefox/4.0.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_0) AppleWebKit/535.11 Chrome/17.0.963.56 Safari/535.11',
    'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)',
    'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 Chrome/77.0.3865.75 Mobile Safari/537.36',
]

# ── 配置路径：统一使用 server_config.json（通过 scripts/config.py）──
# 旧 wechat_config.json 将被忽略；cookie/token 请通过设置页或统一配置管理
import os as _os
_scr = _os.path.dirname(_os.path.abspath(__file__))
if _scr not in sys.path:
    sys.path.insert(0, _scr)
from config import get_config, set_config, reload_config


# ═══════════════════════════════════════════════════════════════
# 1. 搜索公众号
# ═══════════════════════════════════════════════════════════════

def search_accounts(query: str, count: int = 5, begin: int = 0):
    """搜索微信公众号，返回账号列表。

    begin: 起始偏移量（用于分页），0=第一页
    count: 返回数量

    返回: [{"fakeid": "...", "nickname": "...", "signature": "..."}, ...]
    """
    token = get_config("wechat.token")
    cookie = get_config("wechat.cookie")
    if not token or not cookie:
        print("❌ 未配置 token/cookie，请在设置页配置微信凭证，或运行: python3 wechat_crawl.py auth")
        return []

    page_size = 10
    data = {
        "token": token, "lang": "zh_CN", "f": "json", "ajax": "1",
        "action": "search_biz", "begin": begin, "count": page_size, "query": query
    }
    result_list = []
    retrieved = 0
    flag = False

    while (count == -1 or retrieved < count) and not flag:
        headers = {"Cookie": cookie, "User-Agent": random.choice(USER_AGENTS)}
        try:
            session = requests.Session()
            session.trust_env = False
            resp = session.get("https://mp.weixin.qq.com/cgi-bin/searchbiz", headers=headers, params=data, timeout=10)
            content_json = resp.json()

            if content_json.get("base_resp", {}).get("ret") != 0:
                print(f"❌ 请求失败: {content_json.get('base_resp', {}).get('err_msg', '未知错误')}")
                break

            publish_list = content_json.get("list")
            if not publish_list:
                print("没有更多数据了")
                break

            for item in publish_list:
                result_list.append({
                    'fakeid': item["fakeid"],
                    'nickname': item["nickname"],
                    'signature': item.get("signature", ""),
                    'service_type': item.get("service_type", ""),
                })
                retrieved += 1
                if count != -1 and retrieved >= count:
                    flag = True
                    break
            if flag:
                break
            data["begin"] += page_size
            time.sleep(random.randint(2, 5))
        except Exception as e:
            print(f"❌ 异常: {e}")
            break

    return result_list


# ═══════════════════════════════════════════════════════════════
# 2. 获取文章列表
# ═══════════════════════════════════════════════════════════════

def get_articles(fakeid: str, count: int = 30):
    """获取指定公众号的文章列表。

    返回: [{"create_time": "...", "title": "...", "link": "...", "digest": "..."}, ...]
    """
    token = get_config("wechat.token")
    cookie = get_config("wechat.cookie")
    if not token or not cookie:
        print("❌ 未配置 token/cookie，请在设置页配置微信凭证，或运行: python3 wechat_crawl.py auth")
        return []

    page_size = 20
    data = {
        "token": token, "lang": "zh_CN", "f": "json", "ajax": "1",
        "sub_action": "list_ex", "begin": 0, "count": page_size, "fakeid": fakeid
    }
    result_list = []
    retrieved = 0
    flag = False

    while (count == -1 or retrieved < count) and not flag:
        headers = {"Cookie": cookie, "User-Agent": random.choice(USER_AGENTS)}
        try:
            session = requests.Session()
            session.trust_env = False
            resp = session.get("https://mp.weixin.qq.com/cgi-bin/appmsgpublish", headers=headers, params=data, timeout=10)
            content_json = resp.json()

            if content_json.get("base_resp", {}).get("ret") != 0:
                print(f"❌ 请求失败: {content_json.get('base_resp', {}).get('err_msg', '未知错误')}")
                break

            if not content_json.get("publish_page"):
                print("没有更多数据了")
                break

            publish_data = json.loads(content_json["publish_page"])
            publish_list = publish_data.get("publish_list", [])
            if not publish_list:
                break

            for item in publish_list:
                try:
                    publish_info = json.loads(item["publish_info"])
                    for appmsgex in publish_info.get("appmsgex", [{}]):
                        create_time = datetime.fromtimestamp(appmsgex.get("create_time", 0))
                        article = {
                            "create_time": create_time.strftime('%Y-%m-%d %H:%M:%S'),
                            "title": appmsgex.get("title", "").replace('<em class="highlight">', '').replace('</em>', ''),
                            "link": appmsgex.get("link", ""),
                            "digest": appmsgex.get("digest", ""),
                            "cover": appmsgex.get("cover", ""),
                        }
                        result_list.append(article)
                        retrieved += 1
                        if count != -1 and retrieved >= count:
                            flag = True
                            break
                    if flag:
                        break
                except (KeyError, json.JSONDecodeError) as e:
                    print(f"⚠ 解析文章出错: {e}")
                    continue
            if flag:
                break
            data["begin"] += len(publish_list)
            time.sleep(random.randint(2, 5))
        except Exception as e:
            print(f"❌ 异常: {e}")
            break

    return result_list[:count] if count != -1 else result_list


# ═══════════════════════════════════════════════════════════════
# 3. 提取文章正文
# ═══════════════════════════════════════════════════════════════

def get_article_content(url: str):
    """获取公众号文章标题和正文纯文本（不含图片）。

    返回: {"title": "...", "content": "..."} 或 None
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
    }
    try:
        session = requests.Session()
        session.trust_env = False
        resp = session.get(url, headers=headers, timeout=15)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'html.parser')
        title_elem = soup.find('h1', class_='rich_media_title')
        if not title_elem:
            return None
        title = title_elem.get_text(strip=True)

        content_div = soup.find('div', id='js_content') or soup.find('div', class_='rich_media_content')
        if not content_div:
            return None

        for tag in content_div.find_all(['script', 'style', 'iframe']):
            tag.decompose()
        content = content_div.get_text('\n', strip=True)

        return {'title': title, 'content': content}
    except Exception:
        return None


def _download_image(img_url, save_dir, img_idx, img_type, session, headers, article_url):
    """下载单张图片到本地"""
    img_url = unquote(img_url).replace(' ', '')
    img_url = urljoin(article_url, img_url)
    try:
        img_resp = session.get(img_url, headers=headers, timeout=15, stream=True)
        img_resp.raise_for_status()
        content_type = img_resp.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            return None
        suffix = content_type.split('/')[-1] if content_type else 'jpg'
        suffix = suffix if suffix in ['jpg', 'png', 'jpeg', 'gif', 'webp'] else 'jpg'
        filename = f"{img_type}_{img_idx}.{suffix}"
        path = os.path.join(save_dir, filename)
        with open(path, 'wb') as f:
            for chunk in img_resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return path
    except Exception:
        return None


def _parse_html_to_md(element, img_dir, session, headers, article_url, img_counter):
    """递归解析 HTML → Markdown 列表"""
    md_lines = []
    for child in element.children:
        if not child.name:
            continue
        if child.name == "img":
            src = child.get('data-src') or child.get('src')
            if src:
                path = _download_image(src, img_dir, img_counter['count'], "img", session, headers, article_url)
                if path:
                    alt = child.get('alt', '图片')
                    md_lines.append(f"![{alt}](images/{os.path.basename(path)})\n")
                img_counter['count'] += 1
        elif child.name == "p":
            text = child.get_text(strip=True).replace("​", "").replace("\xa0", " ")
            if text:
                md_lines.append(text + "\n")
        elif child.name in ["h2", "h3", "h4"]:
            text = child.get_text(strip=True)
            if text:
                level = int(child.name[1])
                md_lines.append(f"{'#' * level} {text}\n")
        elif child.name in ["ul", "ol"]:
            for li in child.find_all("li"):
                text = li.get_text(strip=True).replace("​", "")
                if text:
                    md_lines.append(f"- {text}\n")
        elif child.name in ["section", "div", "span", "article", "figure", "figcaption", "svg"]:
            # SVG: check for data-lazy-bgimg
            if child.name == "svg":
                svg_url = child.get('data-lazy-bgimg')
                if svg_url:
                    path = _download_image(svg_url, img_dir, img_counter['count'], "svg", session, headers, article_url)
                    if path:
                        md_lines.append(f"![SVG](images/{os.path.basename(path)})\n")
                    img_counter['count'] += 1
            md_lines.extend(_parse_html_to_md(child, img_dir, session, headers, article_url, img_counter))
    return md_lines


def article_to_markdown(url: str, output_dir: str = None):
    """下载微信文章 + 图片 → 本地 Markdown 文件。

    返回: {"status": "success|failed", "md_path": "...", "img_count": N}
    """
    if output_dir is None:
        output_dir = os.path.join(os.getcwd(), "wechat_media")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/',
    }

    result = {"status": "failed", "md_path": "", "img_count": 0}
    session = requests.Session()
    session.trust_env = False

    try:
        resp = session.get(url, headers=headers, timeout=15, allow_redirects=True)
        resp.encoding = resp.apparent_encoding or 'utf-8'

        if "loginpage" in resp.url:
            result["msg"] = "需登录访问"
            print("❌ 需登录访问")
            return result

        soup = BeautifulSoup(resp.text, 'lxml')
        title_elem = soup.find('h1', class_='rich_media_title')
        if not title_elem:
            print("❌ 未找到标题")
            return result

        raw_title = title_elem.get_text(strip=True)
        safe_title = re.sub(r'[\/:*?"<>|]', '_', raw_title)
        group_dir = os.path.join(output_dir, safe_title)
        img_dir = os.path.join(group_dir, "images")
        os.makedirs(img_dir, exist_ok=True)

        content_div = soup.find('div', id='js_content') or soup.find('div', class_='rich_media_content')
        if not content_div:
            print("❌ 未找到正文")
            return result

        for tag in content_div.find_all(['script', 'style', 'iframe', 'link', 'meta']):
            tag.decompose()

        img_counter = {'count': 1}
        md_lines = [
            f"# {raw_title}",
            f"**原文链接**：{url}",
            f"**采集时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        ]
        md_lines.extend(_parse_html_to_md(content_div, img_dir, session, headers, url, img_counter))

        md_path = os.path.join(group_dir, f"{safe_title}.md")
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_lines).strip())

        result["status"] = "success"
        result["md_path"] = md_path
        result["img_count"] = img_counter['count'] - 1
        print(f"✅ 已保存: {md_path} ({result['img_count']} 张图片)")

    except Exception as e:
        print(f"❌ {e}")

    return result


# ═══════════════════════════════════════════════════════════════
# 4. 提取 Chrome 登录态
# ═══════════════════════════════════════════════════════════════

def extract_auth_from_chrome():
    """从 Chrome 浏览器提取 mp.weixin.qq.com 的 token 和 cookie。

    前提：Chrome 已登录 mp.weixin.qq.com 后台。
    """
    import subprocess
    import sqlite3
    import os

    # Chrome cookie 存储路径
    chrome_profile = os.path.expanduser("~/Library/Application Support/baoyu-skills/chrome-profile")
    cookie_db = os.path.join(chrome_profile, "Default", "Cookies")

    # 先尝试从 baoyu profile
    if not os.path.exists(cookie_db):
        # 尝试默认 Chrome profile
        cookie_db = os.path.expanduser("~/Library/Application Support/Google/Chrome/Default/Cookies")

    if not os.path.exists(cookie_db):
        print("❌ 未找到 Chrome Cookie 数据库")
        print("   请先登录 mp.weixin.qq.com")
        return None

    try:
        # 复制 cookie 数据库（Chrome 会锁定它）
        import shutil
        tmp_db = "/tmp/chrome_cookies_temp.db"
        shutil.copy2(cookie_db, tmp_db)

        conn = sqlite3.connect(tmp_db)
        cursor = conn.cursor()

        # 获取 mp.weixin.qq.com 的 cookies
        cursor.execute("""
            SELECT name, value FROM cookies
            WHERE host_key LIKE '%mp.weixin.qq.com%'
        """)
        cookies = {row[0]: row[1] for row in cursor.fetchall()}
        conn.close()

        # 拼成 cookie string
        cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])

        # 尝试从 cookie 中提取 token
        token = cookies.get("token", "")

        if not token or not cookie_str:
            print("⚠ token 未找到，将使用 cookie 尝试请求")
            print("   可手动从浏览器 F12 → Application → Cookies 复制 token")

        return {"token": token, "cookie": cookie_str}

    except Exception as e:
        print(f"❌ 提取失败: {e}")
        print("   可手动配置: 在设置页填写微信凭证，或编辑 server_config.json")
        return None


def cmd_auth():
    """auth 子命令：提取并保存 token/cookie 到统一配置"""
    auth = extract_auth_from_chrome()
    if auth:
        set_config("wechat.token", auth["token"])
        set_config("wechat.cookie", auth["cookie"])
        print("✅ 已保存到: server_config.json [wechat.token, wechat.cookie]")
        print(f"   token: {auth['token'][:20]}..." if len(auth['token']) > 20 else f"   token: {auth['token']}")


# ═══════════════════════════════════════════════════════════════
# 5. 飞书同步
# ═══════════════════════════════════════════════════════════════

from config import FEISHU_BASE_TOKEN

FEISHU_TABLE_ID = "tblQ9Jj095axnoQF"  # 文章列表


def _get_existing_urls():
    """获取飞书素材库中已有的所有文章 URL 集合"""
    import subprocess
    urls = set()
    try:
        result = subprocess.run([
            "lark-cli", "base", "+record-list",
            "--base-token", FEISHU_BASE_TOKEN,
            "--table-id", FEISHU_TABLE_ID,
            "--limit", "500",
            "--format", "json"
        ], capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        records = data.get("data", {}).get("data", [])
        for record in records:
            if isinstance(record, list) and len(record) >= 2:
                if len(record) > 12 and record[12]: urls.add(record[12])
    except:
        pass
    return urls


def sync_articles_to_feishu(articles, account_name="", account_id=""):
    """将文章列表写入飞书素材库，按 URL 去重。

    Args:
        articles: get_articles() 返回的文章列表
        account_name: 来源公众号名称
        account_id: 来源公众号 fakeid
    Returns:
        (new_count, skip_count)
    """
    import subprocess
    existing_urls = _get_existing_urls()
    new_count = 0
    skip_count = 0

    for article in articles:
        url = article.get("link", "")
        if not url:
            continue

        if url in existing_urls:
            skip_count += 1
            continue
            continue

        # 写入飞书
        title = article.get("title", "")
        title_md = f"[{title}]({url})"  # 飞书中显示为可点击链接
        fields = ["文章标题", "主键", "文章摘要", "发布时间", "账号标识", "账号名称", "状态"]
        rows = [[
            title_md,
            url,
            article.get("digest", "")[:200] if article.get("digest") else "",
            article.get("create_time", ""),
            account_id,
            account_name,
            "新增"
        ]]
        title_short = article.get("title", "")[:30]

        try:
            result = subprocess.run([
                "lark-cli", "base", "+record-batch-create",
                "--base-token", FEISHU_BASE_TOKEN,
                "--table-id", FEISHU_TABLE_ID,
                "--json", json.dumps({"fields": fields, "rows": rows}),
                "--format", "json"
            ], capture_output=True, text=True, timeout=15)
            resp = json.loads(result.stdout)
            if resp.get("ok"):
                new_count += 1
            else:
                print(f"  ⚠ 写入失败: {title_short}... - {resp.get('error', {}).get('message', '')}")
        except Exception as e:
            print(f"  ⚠ 写入异常: {title_short}... - {e}")

    return new_count, skip_count


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == "auth":
        cmd_auth()

    elif cmd == "search":
        if len(sys.argv) < 3:
            print("用法: wechat_crawl.py search <关键词>")
            return
        query = sys.argv[2]
        count = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        print(f"🔍 搜索公众号: {query}")
        results = search_accounts(query, count)
        for r in results:
            print(f"  {r['nickname']} | fakeid: {r['fakeid']}")
            print(f"    {r['signature'][:80]}")
        print(f"\n找到 {len(results)} 个账号")

    elif cmd == "articles":
        if len(sys.argv) < 3:
            print("用法: wechat_crawl.py articles <fakeid> [数量] [--sync-feishu] [--account-name <名称>]")
            return
        fakeid = sys.argv[2]
        count = 30
        sync_feishu = False
        account_name = ""
        args = sys.argv[3:]
        i = 0
        while i < len(args):
            if args[i] == "--sync-feishu":
                sync_feishu = True
            elif args[i] == "--account-name" and i+1 < len(args):
                account_name = args[i+1]
                i += 1
            else:
                try:
                    count = int(args[i])
                except:
                    pass
            i += 1

        print(f"📄 获取文章: fakeid={fakeid}, count={count}")
        articles = get_articles(fakeid, count)
        for i, a in enumerate(articles):
            print(f"  [{i+1}] {a['create_time']} | {a['title'][:60]}")
            print(f"      {a['link']}")
        print(f"\n共 {len(articles)} 篇")

        if sync_feishu and articles:
            print(f"\n📡 同步到飞书素材库...")
            new, skip = sync_articles_to_feishu(articles, account_name, fakeid)
            print(f"✅ 新增 {new} 篇，跳过 {skip} 篇（已存在）")

    elif cmd == "pull-accounts":
        # 从飞书账号列表拉取对标账号到 benchmark.json
        import subprocess
        print("📡 从飞书拉取对标账号...")
        result = subprocess.run([
            "lark-cli", "base", "+record-list",
            "--base-token", FEISHU_BASE_TOKEN,
            "--table-id", "tbloLzUPoKoBOHti",
            "--limit", "50",
            "--format", "json"
        ], capture_output=True, text=True, timeout=15)
        data = json.loads(result.stdout)
        records = data.get("data", {}).get("data", [])

        # Read existing benchmark
        benchmark_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "benchmark.json")
        if not os.path.exists(benchmark_path):
            benchmark_path = os.path.join(os.getcwd(), "collect", "benchmark.json")

        existing = {}
        if os.path.exists(benchmark_path):
            with open(benchmark_path) as f:
                b = json.load(f)
                for a in b.get("accounts", []):
                    if a.get("fakeid"):
                        existing[a["fakeid"]] = a

        new_count = 0
        for r in records:
            name = str(r[0]) if r[0] else ""
            fakeid = str(r[3]) if len(r) > 3 and r[3] else ""  # record ID IS the fakeid
            if fakeid and fakeid not in existing:
                existing[fakeid] = {
                    "platform": "wechat-mp",
                    "fakeid": fakeid,
                    "name": name,
                    "niche": "未分类",
                    "priority": "P1",
                    "enabled": True,
                    "sync_to_feishu": True,
                    "last_sync": None,
                    "article_count": 0,
                    "notes": ""
                }
                new_count += 1
                print(f"  + {name} ({fakeid[:16]}...)")

        if new_count > 0:
            # Save back
            all_accounts = list(existing.values())
            with open(benchmark_path, 'w') as f:
                json.dump({"_schema": "对标账号配置", "accounts": all_accounts}, f, indent=2, ensure_ascii=False)
            print(f"✅ 新增 {new_count} 个账号 → {benchmark_path}")
        else:
            print("✅ 无新增账号（均已同步）")

    elif cmd == "sync-all":
        # 从飞书账号列表读取对标账号（唯一数据源）
        import subprocess
        accounts = []

        result = subprocess.run([
            "lark-cli", "base", "+record-list",
            "--base-token", FEISHU_BASE_TOKEN,
            "--table-id", "tbloLzUPoKoBOHti",
            "--limit", "50",
            "--format", "json"
        ], capture_output=True, text=True, timeout=15)
        data = json.loads(result.stdout)
        records = data.get("data", {}).get("data", [])
        for r in records:
            name = str(r[0]) if r[0] else ""
            fakeid = str(r[3]) if len(r) > 3 and r[3] else ""
            if fakeid:
                accounts.append({"platform": "wechat-mp", "name": name, "fakeid": fakeid, "sync_to_feishu": True})

        if not accounts:
            print("❌ 飞书账号列表为空，请在飞书「微信公众号内容工厂→账号列表」中添加对标账号")
            return

        print(f"📡 飞书读取 {len(accounts)} 个对标账号")

        total_new = 0
        total_skip = 0
        for acc in accounts:
            platform = acc.get("platform")
            if platform != "wechat-mp":
                continue
            name = acc.get("name", "")
            fakeid = acc.get("fakeid", "")
            count = 10  # default per account per sync
            print(f"\n📄 【{name}】fakeid={fakeid[:16]}...")
            articles = get_articles(fakeid, count)
            print(f"  获取 {len(articles)} 篇")
            if articles and acc.get("sync_to_feishu"):
                new, skip = sync_articles_to_feishu(articles, name, fakeid)
                total_new += new
                total_skip += skip

        print(f"\n✅ 同步完成：新增 {total_new} 篇，跳过 {total_skip} 篇")

    elif cmd == "content":
        if len(sys.argv) < 3:
            print("用法: wechat_crawl.py content <url> [输出目录]")
            return
        url = sys.argv[2]
        output_dir = sys.argv[3] if len(sys.argv) > 3 else None
        article_to_markdown(url, output_dir)

    else:
        print(f"未知命令: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    main()
