from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.ai.service import generate_suggestion
from backend import models

router = APIRouter(prefix="/api", tags=["AIConsult"])


class ConsultBody(BaseModel):
    question: str
    user_id: Optional[int] = None  # Changed to Optional to prevent 422 if user context is missing


@router.post("/ai-consultation")
def ai_consultation(body: ConsultBody, db: Session = Depends(get_db)):
    print(f"Received AI consultation request: {body.question[:50]}... User: {body.user_id}")
    try:
        # Fetch patient context
        patient_info = ""
        if body.user_id:
            patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == body.user_id).first()
            
            if patient_profile:
                # Calculate age if possible, or just pass ID/Name
                patient_info = f"患者姓名: {patient_profile.name or '未知'}"
                if patient_profile.id_card and len(patient_profile.id_card) == 18:
                     # Simple age estimation from ID card (optional, but helpful)
                     try:
                         birth_year = int(patient_profile.id_card[6:10])
                         import datetime
                         current_year = datetime.datetime.now().year
                         age = current_year - birth_year
                         patient_info += f", 年龄: {age}岁"
                     except:
                         pass

        # Fetch available departments
        available_departments = []
        try:
            departments = db.query(models.DoctorProfile.department).distinct().all()
            available_departments = [d[0] for d in departments if d[0]]
        except Exception as e:
            print(f"Error fetching departments: {e}")

        payload = {
            "symptoms": body.question,
            "diagnosis": "",
            "medications": [],
            "constraints": {
                "patient_info": patient_info,
                "available_departments": available_departments
            },
            "language": "zh"
        }
        result = generate_suggestion(payload)
        if result.get("success"):
            return {"answer": result.get("content", ""), "suggestions": []}
        else:
            fallback = result.get("fallback")
            # Return 200 with fallback instead of 502 to handle it gracefully in frontend
            return {"answer": fallback, "suggestions": [], "is_fallback": True}
    except Exception as e:
        print(f"AI Consultation Error: {e}")
        return {
            "answer": "AI服务暂时遇到内部错误，请稍后再试。建议您直接前往医院就诊。",
            "suggestions": [],
            "is_fallback": True
        }


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
