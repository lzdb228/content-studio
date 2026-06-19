"""
对标账号文章采集 — 使用 wechat_crawl.py 从微信公众号爬取文章，写入飞书素材库。
v1.1: 采集开关过滤 (XIN-97) + 日期筛选 (XIN-98) + 去重验证 (XIN-99)
"""

import sys
import os
from datetime import datetime

# 确保能找到 wechat_crawl.py
_scripts = os.path.dirname(os.path.abspath(__file__))
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

from bitable import get_accounts, get_articles as get_feishu_articles, save_article


def sync_all(begin_date: str = "", end_date: str = "") -> list[dict]:
    """遍历对标账号，抓取最新文章存入素材库。
    
    参数:
        begin_date: 起始日期 "YYYY-MM-DD"（含），空=不限
        end_date:   截止日期 "YYYY-MM-DD"（含），空=不限
    
    返回: [{"success": bool, "account_name": str, "new_articles": int,
             "filtered": int, "deduped": int, ...}]
    
    前置条件: 先运行 python3 wechat_crawl.py auth 提取 token/cookie。
    """
    import wechat_crawl

    # 解析日期筛选范围
    dt_begin = None
    dt_end = None
    if begin_date:
        try:
            dt_begin = datetime.strptime(begin_date, "%Y-%m-%d")
        except ValueError:
            dt_begin = None
    if end_date:
        try:
            dt_end = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            dt_end = None

    accounts = get_accounts()
    existing = get_feishu_articles()
    existing_urls = {a.get("url", "") for a in existing if a.get("url")}
    
    results = []
    for acct in accounts:
        # XIN-97: 跳过「采集关闭」的账号
        if acct.get("status") == "停更" or acct.get("status") == False:
            results.append({
                "success": True,
                "account_name": acct.get("name", ""),
                "new_articles": 0,
                "updated_articles": 0,
                "filtered": 0,
                "deduped": 0,
                "note": "采集已关闭，跳过",
            })
            continue

        name = acct.get("name", "")
        fakeid = acct.get("identifier", "")
        
        if not fakeid or len(fakeid) < 10:
            results.append({
                "success": False,
                "account_name": name,
                "new_articles": 0,
                "updated_articles": 0,
                "filtered": 0,
                "deduped": 0,
                "error": "缺少有效账号标识",
            })
            continue
        
        # 统计已有文章数
        existing_count = sum(1 for a in existing if a.get("source", "") == name)
        
        try:
            # 有日期筛选时多抓一些（避免筛选后数量不足）
            fetch_count = 30 if (dt_begin or dt_end) else 5
            articles = wechat_crawl.get_articles(fakeid, count=fetch_count)
            
            # XIN-98: 日期筛选
            filtered_count = 0
            if dt_begin or dt_end:
                filtered = []
                for art in articles:
                    try:
                        art_dt = datetime.strptime(art.get("create_time", "1970-01-01 00:00:00"), "%Y-%m-%d %H:%M:%S")
                        if dt_begin and art_dt < dt_begin:
                            filtered_count += 1
                            continue
                        if dt_end and art_dt > dt_end:
                            filtered_count += 1
                            continue
                        filtered.append(art)
                    except ValueError:
                        filtered.append(art)  # 无法解析日期，保留
                articles = filtered
            
            # XIN-99: 去重 — URL 去重 + 同批次标题去重
            deduped_count = 0
            new_count = 0
            seen_titles = set()
            
            for art in articles:
                url = art.get("link", "")
                
                # URL 去重（全局）
                if url and url in existing_urls:
                    deduped_count += 1
                    continue
                
                # 同批次标题去重
                title = art.get("title", "(无标题)")
                title_key = f"{name}|{title}"
                if title_key in seen_titles:
                    deduped_count += 1
                    continue
                seen_titles.add(title_key)
                
                digest = art.get("digest", "")
                content = digest  # 摘要作为内容（完整内容需 article_to_markdown）
                
                # 尝试获取完整内容
                try:
                    if url:
                        full = wechat_crawl.article_to_markdown(url, f"/tmp/wechat_{fakeid[:8]}")
                        if full.get("status") == "success":
                            with open(full["md_path"]) as f:
                                content = f.read()[:5000]
                except Exception:
                    pass  # 降级使用摘要
                
                ok = save_article(title, content, name, "", link=url)
                if ok:
                    new_count += 1
                    existing_urls.add(url)
            
            results.append({
                "success": True,
                "account_name": name,
                "new_articles": new_count,
                "updated_articles": existing_count,
                "filtered": filtered_count,
                "deduped": deduped_count,
                "note": f"抓取 {len(articles)} 篇，筛选掉 {filtered_count}，去重 {deduped_count}，新增 {new_count} 篇",
            })
        
        except Exception as e:
            err = str(e)
            results.append({
                "success": False,
                "account_name": name,
                "new_articles": 0,
                "updated_articles": existing_count,
                "filtered": 0,
                "deduped": 0,
                "error": err[:200],
            })
    
    return results


if __name__ == "__main__":
    results = sync_all()
    for r in results:
        icon = "✅" if r["success"] else "❌"
        print(f"{icon} {r['account_name']}: 新增 {r['new_articles']} / 已有 {r['updated_articles']}")
        if r.get("note"):
            print(f"   📝 {r['note']}")
        if r.get("error"):
            print(f"   ⚠️ {r['error']}")
