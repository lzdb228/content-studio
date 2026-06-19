"""
AI 改写 — 脚本拼 prompt + 调 LLM API。
纯脚本负责：风格查表、prompt 组装、结果格式化。
LLM 负责：文本改写本身。
"""

import json
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import DASHSCOPE_KEY

DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

# 风格 → 改写提示词模板
STYLE_PROMPTS = {
    "星流": """请按以下风格改写文本：
- 使用短句，每段不超过3句
- 第一人称叙事，语气亲切自然
- 文末抛出一个开放式问题，引导读者互动
- 保留原文核心观点和关键信息

原文：""",
    "备用风格": """请按以下风格改写文本：
- 数据驱动，引用具体数字和事实
- 三段式结构：现象→分析→结论
- 语言简洁有力，避免冗余修饰

原文：""",
}


def ai_rewrite(text: str, style_name: str = "") -> dict:
    """改写文本。返回 {rewritten, style_used}。"""
    # 查风格表
    from scripts.bitable import get_styles
    styles = get_styles()
    style = next((s for s in styles if s["name"] == style_name), None)

    if style and style["features"]:
        # 用真实风格特征拼 prompt
        features_text = "\n".join(f"- {f}" for f in style["features"])
        prompt = f"请按以下风格特征改写文本：\n{features_text}\n\n原文：\n{text}"
    elif style_name in STYLE_PROMPTS:
        prompt = STYLE_PROMPTS[style_name] + "\n" + text
    else:
        # 无风格：通用改写
        prompt = f"请对以下文本进行润色改写，保持原意，提升可读性：\n\n{text}"

    rewritten = _call_llm(prompt, max_tokens=800)
    return {
        "rewritten": rewritten,
        "style_used": style_name or "通用改写",
    }


def _call_llm(prompt: str, max_tokens: int = 500, model: str = "qwen-plus") -> str:
    """调 DashScope API，返回纯文本。"""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }, ensure_ascii=False)

    r = subprocess.run([
        "curl", "-s", "--max-time", "60",
        "-X", "POST", DASHSCOPE_URL,
        "-H", f"Authorization: Bearer {DASHSCOPE_KEY}",
        "-H", "Content-Type: application/json",
        "-d", payload,
    ], capture_output=True, text=True, timeout=70)

    try:
        d = json.loads(r.stdout)
        return d["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[rewrite] LLM call failed: {e}", file=sys.stderr)
        print(f"[rewrite] raw: {r.stdout[:200]}", file=sys.stderr)
        return f"[改写失败] {text[:100]}..."


if __name__ == "__main__":
    result = ai_rewrite("最近试了很多AI写作工具", "星流")
    print(result["rewritten"])
