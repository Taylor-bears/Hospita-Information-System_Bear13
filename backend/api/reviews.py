# 文件: `backend/api/reviews.py`
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, conint

from backend import models
from backend.database import get_db

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    appointment_id: int
    doctor_id: int
    rating: conint(ge=1, le=5)
    comment: str | None = None


class DoctorRating(BaseModel):
    doctor_id: int
    avg_rating: float | None = None
    review_count: int = 0


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_review(
    data: ReviewCreate,
    patient_id: int,  # 仿照其它接口：用 query 参数传入当前用户 id
    db: Session = Depends(get_db),
):
    # （无 dependencies 文件时）先不做 current_user.role 校验，只按 patient_id 落库

    # 一次预约只能评一次
    exists = (
        db.query(models.DoctorReview)
        .filter(models.DoctorReview.appointment_id == data.appointment_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="该预约已评价")

    review = models.DoctorReview(
        appointment_id=data.appointment_id,
        patient_id=patient_id,
        doctor_id=data.doctor_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"id": review.id}


@router.get("/doctor/{doctor_id}/rating", response_model=DoctorRating)
def get_doctor_rating(doctor_id: int, db: Session = Depends(get_db)):
    q = (
        db.query(
            models.DoctorReview.doctor_id,
            func.avg(models.DoctorReview.rating).label("avg_rating"),
            func.count(models.DoctorReview.id).label("review_count"),
        )
        .filter(models.DoctorReview.doctor_id == doctor_id)
        .group_by(models.DoctorReview.doctor_id)
        .first()
    )

    if not q:
        return DoctorRating(doctor_id=doctor_id, avg_rating=None, review_count=0)

    return DoctorRating(
        doctor_id=doctor_id,
        avg_rating=float(q.avg_rating),
        review_count=q.review_count,
    )