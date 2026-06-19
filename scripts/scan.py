"""
去AI扫描 — 脚本预处理 + 调 LLM 检测 AI 痕迹。
脚本负责：文本分句、统计基本指标。
LLM 负责：检测 AI 生成特征（模式化表达、情感浓度、句式多样性）。
"""

import json
import random
import subprocess
import sys
import re
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import DASHSCOPE_KEY

DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

SCAN_PROMPT = """你是一个文本分析专家。请分析以下文本是否为 AI 生成，按以下维度打分（1-7，1=强烈AI痕迹，7=完全人类写作）：

1. AI 痕迹词：是否出现"在当今""总而言之""值得注意的是"等模板化表达
2. 句式多样性：句子长度是否变化，结构是否丰富
3. 个人语气：是否有独特的声音和个性
4. 重复表达：是否有不必要的重复或冗余
5. 互动引导：是否有自然的问题、感叹或情感流露

返回 JSON 格式（只返回 JSON，不要其他文字）：
{"scores":{"ai_traces":5,"sentence_variety":4,"personal_voice":3,"repetition":6,"interaction":4},"verdict":"可能是AI辅助写作","summary":"..."}

文本："""


def ai_scan(text: str) -> dict:
    """扫描文本，返回评分报告。"""
    # 脚本：基本统计
    basic_stats = _script_stats(text)

    # LLM：深度分析
    full_prompt = SCAN_PROMPT + text
    llm_result = _call_llm(full_prompt, max_tokens=300)

    try:
        analysis = json.loads(llm_result)
    except json.JSONDecodeError:
        # LLM 返回格式不规范，尝试提取 JSON
        match = re.search(r'\{[\s\S]*\}', llm_result)
        if match:
            try:
                analysis = json.loads(match.group())
            except:
                analysis = _fallback_analysis(text)
        else:
            analysis = _fallback_analysis(text)

    return {
        "scores": analysis.get("scores", {}),
        "verdict": analysis.get("verdict", "无法判断"),
        "summary": analysis.get("summary", ""),
        "stats": basic_stats,
        "total_score": sum(analysis.get("scores", {}).values()),
        "max_score": 35,  # 5 dimensions × 7
    }


def _script_stats(text: str) -> dict:
    """纯脚本统计。"""
    sentences = re.split(r'[。！？!?]', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words = text.replace("\n", " ").split()
    return {
        "char_count": len(text),
        "sentence_count": len(sentences),
        "avg_sentence_len": len(text) / max(len(sentences), 1),
        "word_count": len(words),
    }


def _fallback_analysis(text: str) -> dict:
    """LLM 失败时的本地分析。"""
    chars = len(text)
    # 简易规则：非常短或非常长的文本评分中等
    return {
        "scores": {
            "ai_traces": 5,
            "sentence_variety": 4,
            "personal_voice": 4,
            "repetition": 5,
            "interaction": 4,
        },
        "verdict": "本地初步分析（LLM 不可用）",
        "summary": f"文本长度 {chars} 字，建议人工复核。",
    }


def _call_llm(prompt: str, max_tokens: int = 500) -> str:
    payload = json.dumps({
        "model": "qwen-plus",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
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
        print(f"[scan] LLM call failed: {e}", file=sys.stderr)
        return json.dumps(_fallback_analysis(prompt[-500:]), ensure_ascii=False)


if __name__ == "__main__":
    result = ai_scan("最近试了很多AI写作工具，发现一个规律：把AI当助理而不是代笔，效果最好。")
    print(json.dumps(result, indent=2, ensure_ascii=False))
