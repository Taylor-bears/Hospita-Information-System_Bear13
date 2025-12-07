from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from .service import generate_suggestion


router = APIRouter(prefix="/api/ai", tags=["AI"])


class SuggestionRequest(BaseModel):
    symptoms: str = Field("")
    diagnosis: Optional[str] = Field(None)
    medications: List[str] = Field(default_factory=list)
    constraints: Dict[str, Any] = Field(default_factory=dict)
    language: str = Field("zh")


@router.post("/suggest")
def ai_suggest(req: SuggestionRequest):
    result = generate_suggestion(req.model_dump())
    return result


@router.get("/health")
def ai_health():
    return {"openrouter_configured": bool(os.getenv("OPEN_ROUTER_API_KEY")), "deepseek_configured": bool(os.getenv("DEEPSEEK_API_KEY"))}

