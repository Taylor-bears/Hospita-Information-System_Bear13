import os
import json
import time
from typing import Dict, Any, Optional

import requests
from dotenv import load_dotenv

ROOT_ENV = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.exists(ROOT_ENV):
    load_dotenv(ROOT_ENV)


class AISuggestionError(Exception):
    def __init__(self, message: str, code: str = "ai_error", detail: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.detail = detail or {}


def _call_openrouter(messages: list, model: str = "deepseek/deepseek-chat", temperature: float = 0.2, max_tokens: int = 800) -> str:
    api_key = os.getenv("OPEN_ROUTER_API_KEY")
    if not api_key:
        raise AISuggestionError("OPEN_ROUTER_API_KEY 未配置", code="openrouter_key_missing")

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173/",
        "X-Title": "Medical System"
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=15)
        if resp.status_code >= 400:
            raise AISuggestionError("OpenRouter 请求失败", code="openrouter_http_error", detail={"status": resp.status_code, "body": resp.text})
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except requests.Timeout:
        raise AISuggestionError("OpenRouter 请求超时", code="openrouter_timeout")
    except Exception as e:
        if isinstance(e, AISuggestionError):
            raise e
        raise AISuggestionError("OpenRouter 调用异常", code="openrouter_exception", detail={"error": str(e)})


def _call_deepseek(messages: list, model: str = "deepseek-chat", temperature: float = 0.2, max_tokens: int = 800) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise AISuggestionError("DEEPSEEK_API_KEY 未配置", code="deepseek_key_missing")

    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=15)
        if resp.status_code >= 400:
            raise AISuggestionError("DeepSeek 请求失败", code="deepseek_http_error", detail={"status": resp.status_code, "body": resp.text})
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except requests.Timeout:
        raise AISuggestionError("DeepSeek 请求超时", code="deepseek_timeout")
    except Exception as e:
        if isinstance(e, AISuggestionError):
            raise e
        raise AISuggestionError("DeepSeek 调用异常", code="deepseek_exception", detail={"error": str(e)})


def generate_suggestion(payload: Dict[str, Any]) -> Dict[str, Any]:
    symptoms = payload.get("symptoms", "")
    diagnosis = payload.get("diagnosis", "")
    medications = payload.get("medications", [])
    constraints = payload.get("constraints", {})
    language = payload.get("language", "zh")

    messages = [
        {"role": "system", "content": "你是资深临床决策助手，请基于输入提供安全、合规且可操作的建议，避免诊断结论。"},
        {"role": "user", "content": json.dumps({
            "symptoms": symptoms,
            "diagnosis": diagnosis,
            "medications": medications,
            "constraints": constraints,
            "language": language,
        }, ensure_ascii=False)},
    ]

    start = time.time()
    try:
        if os.getenv("OPEN_ROUTER_API_KEY"):
            content = _call_openrouter(messages)
        else:
            content = _call_deepseek(messages)
        duration_ms = int((time.time() - start) * 1000)
        return {"success": True, "content": content, "duration_ms": duration_ms}
    except AISuggestionError as e:
        # 备用方案：返回通用注意事项模板
        fallback = (
            "AI服务暂不可用。一般建议：\n"
            "- 就近就医并遵医嘱，勿自行服药加量\n"
            "- 如出现高热、呼吸困难或症状加重，立即就诊\n"
            "- 充分休息、补充水分，注意隔离与卫生\n"
            "- 对既往过敏或慢性病情况需谨慎处理并咨询医生\n"
        )
        return {"success": False, "error": {"code": e.code, "message": str(e), "detail": e.detail}, "fallback": fallback}

