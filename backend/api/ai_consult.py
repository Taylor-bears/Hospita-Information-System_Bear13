from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.ai.service import generate_suggestion

router = APIRouter(prefix="/api", tags=["AIConsult"])


class ConsultBody(BaseModel):
    question: str
    user_id: str


@router.post("/ai-consultation")
def ai_consultation(body: ConsultBody):
    payload = {
        "symptoms": body.question,
        "diagnosis": "",
        "medications": [],
        "constraints": {},
        "language": "zh"
    }
    result = generate_suggestion(payload)
    if result.get("success"):
        return {"answer": result.get("content", ""), "suggestions": []}
    else:
        fallback = result.get("fallback")
        raise HTTPException(status_code=502, detail=fallback or result.get("error", {}).get("message", "AI服务不可用"))


class BlessingBody(BaseModel):
    order_id: str
    medications: List[str] = []
    user_name: Optional[str] = None
    weather: Optional[str] = None
    season: Optional[str] = None


@router.post("/v1/ai/blessing")
def blessing(body: BlessingBody):
    meds = ", ".join(body.medications) if body.medications else "所购药品"
    variants = [
        f"祝您早日康复！请按医嘱正确使用{meds}，保持作息规律。",
        f"愿健康常伴！{meds}使用期间注意饮食清淡，适度运动。",
        f"保重身体！如有不适及时复诊，{meds}切勿自行加量。",
    ]
    context = []
    if body.weather:
        context.append(f"当前天气：{body.weather}，请注意增减衣物。")
    if body.season:
        context.append(f"季节提示：{body.season}，注意防护与保健。")
    return {
        "notice": f"使用{meds}期间请遵医嘱并留意不良反应。",
        "variants": variants,
        "care": " ".join(context)
    }


# 兼容另一端点
@router.post("/v1/ai/consult")
def ai_consult_v1(body: ConsultBody):
    return ai_consultation(body)
