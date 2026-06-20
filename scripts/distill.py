"""
蒸馏脚本 — 从飞书文章库提取公众号风格特征。
纯脚本：统计（句长/词频/结构）+ API 调用。
AI 负责：风格深度分析（提示词交给模型）。
"""

import subprocess
import json
import re
import os, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import DASHSCOPE_KEY as API_KEY

API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
MODEL = "qwen-plus"

# ─── 脚本层：统计 ──────────────────────────────

def _script_stats(texts: list[str]) -> dict:
    """纯脚本：对一组文章做基础统计。"""
    total_chars = 0
    total_sentences = 0
    all_words: list[str] = []
    paragraphs_per_article: list[int] = []

    for t in texts:
        t = t.strip()
        if not t:
            continue
        total_chars += len(t)
        # 分句：。！？!? 换行
        sentences = re.split(r'[。！？!?\n]+', t)
        sentences = [s.strip() for s in sentences if s.strip()]
        total_sentences += len(sentences)
        all_words.extend(re.findall(r'[\u4e00-\u9fff]+', t))
        # 分段：两个以上换行
        paras = re.split(r'\n\s*\n', t)
        paragraphs_per_article.append(len(paras))

    word_freq = Counter(all_words).most_common(20)
    return {
        "article_count": len(texts),
        "total_chars": total_chars,
        "total_sentences": total_sentences,
        "avg_sentence_len": round(total_chars / max(total_sentences, 1), 1),
        "avg_paragraphs": round(sum(paragraphs_per_article) / max(len(paragraphs_per_article), 1), 1),
        "top_words": [(w, c) for w, c in word_freq if len(w) >= 2][:10],
    }


# ─── AI 层：风格分析 ───────────────────────────

STYLE_ANALYSIS_PROMPT = """你是写作风格分析专家。以下是来自公众号「{account}」的 {n} 篇文章（节选），请分析其写作风格特征。

【基础统计】
{stats}

【文章样本】
{samples}

请提取 5-7 个写作风格特征，用换行分隔，每条不超过 15 字。
特征类型参考：
- 句式：长短句偏好、段落长度习惯
- 语气：第一/第二/第三人称、亲切/正式/犀利
- 结构：开头方式、结尾习惯、论证逻辑
- 用词：高频词汇、修饰风格
- 节奏：标点偏好、段落呼吸感

直接输出特征列表（每行一个），不要加序号和额外说明。"""


def _analyze_style(account: str, texts: list[str], stats: dict) -> list[str]:
    """调 LLM 分析风格，返回特征列表。"""
    # 每篇取前 400 字做样本，最多 5 篇
    samples = "\n\n---\n\n".join(
        t[:400] + ("" if len(t) <= 400 else "...") for t in texts[:5]
    )

    stats_text = "\n".join(
        f"- {k}: {v}" for k, v in stats.items()
    )

    prompt = STYLE_ANALYSIS_PROMPT.format(
        account=account, n=len(texts),
        stats=stats_text, samples=samples,
    )

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 400,
        "temperature": 0.5,
    }

    try:
        r = subprocess.run(
            ["curl", "-s", "--max-time", "45", "-X", "POST", API_URL,
             "-H", f"Authorization: Bearer {API_KEY}",
             "-H", "Content-Type: application/json",
             "-d", json.dumps(payload, ensure_ascii=False)],
            capture_output=True, text=True, timeout=50
        )
        d = json.loads(r.stdout)
        if "choices" in d:
            content = d["choices"][0]["message"]["content"]
            # 按行拆分，过滤空行和序号
            lines = [l.strip().lstrip("1234567890.、-•· ") for l in content.split("\n")]
            return [l for l in lines if l and len(l) >= 4][:7]
        else:
            err = d.get("error", {}).get("message", str(d))
            print(f"[distill] LLM error: {err}", file=__import__("sys").stderr)
            return []
    except Exception as e:
        print(f"[distill] Exception: {e}", file=__import__("sys").stderr)
        return []


# ─── 主入口 ─────────────────────────────────────

def run_distill(account_name: str, article_texts: list[str] | None = None, article_ids: list[str] | None = None) -> dict:
    """蒸馏管线：查文章 → 脚本统计 → AI 分析 → 返回结果。

    Args:
        account_name: 公众号名称
        article_texts: 直接传入的文章内容列表（优先使用）
        article_ids: 从素材库按 ID 筛选文章

    返回: {ok, data: {account, features, stats, article_count}}
    """
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from bitable import get_articles, add_style, get_styles

    # 1. 获取文章内容
    if article_texts:
        # 模式 A：直接使用传入的文章文本
        texts = [t for t in article_texts if t and len(t.strip()) > 20]
    elif article_ids:
        # 模式 B：按 ID 从素材库提取
        all_articles = get_articles()
        id_set = set(article_ids)
        texts = [a["content"] for a in all_articles
                 if a.get("id") in id_set and a.get("content")]
    else:
        # 模式 C：从素材库按账号名匹配（旧逻辑）
        all_articles = get_articles()
        texts = [a["content"] for a in all_articles
                 if a.get("source", "").find(account_name) >= 0 and a.get("content")]
        if not texts:
            texts = [a["content"] for a in all_articles
                     if a.get("content") and len(a.get("content", "")) > 50]

    if not texts:
        return {"ok": False, "error": f"未找到「{account_name}」的文章数据（共找到 {len(texts)} 篇有效内容）"}

    # 限制样本量
    texts = texts[:20]

    # 2. 脚本：基础统计
    stats = _script_stats(texts)

    # 3. AI：风格分析
    features = _analyze_style(account_name, texts, stats)
    if not features:
        # LLM 失败时的 fallback：纯统计特征
        features = [
            f"平均句长 {stats['avg_sentence_len']} 字",
            f"高频词: {', '.join(w for w, _ in stats['top_words'][:3])}",
            f"约 {stats['avg_paragraphs']} 段/篇",
        ]

    # 4. 脚本：写入风格卡
    ok = add_style(account_name, account_name, features)

    return {
        "ok": ok,
        "data": {
            "account": account_name,
            "features": features,
            "stats": stats,
            "article_count": len(texts),
        },
    }


if __name__ == "__main__":
    import sys
    account = sys.argv[1] if len(sys.argv) > 1 else "歸藏的AI工具箱"
    print(f"蒸馏「{account}」...")
    result = run_distill(account)
    if result["ok"]:
        d = result["data"]
        print(f"✅ {d['article_count']} 篇文章 → {len(d['features'])} 特征")
        for f in d["features"]:
            print(f"  - {f}")
        print(f"\n统计: {json.dumps(d['stats'], ensure_ascii=False)}")
    else:
        print(f"❌ {result.get('error')}")
