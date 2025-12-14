from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend import models, schemas
from datetime import datetime

router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.get("/my")
def my_orders(patient_id: int, db: Session = Depends(get_db)):
    """
    获取我的订单（基于处方生成）
    """
    # 获取该患者的所有处方
    prescriptions = db.query(models.Prescription).filter(
        models.Prescription.patient_id == patient_id
    ).order_by(models.Prescription.created_at.desc()).all()

    results = []
    for p in prescriptions:
        # 获取处方项
        items = db.query(models.PrescriptionItem).filter(models.PrescriptionItem.prescription_id == p.id).all()
        order_items = []
        for i in items:
            med = db.query(models.Medication).filter(models.Medication.id == i.medication_id).first()
            order_items.append({
                "drug": {
                    "name": med.name if med else "未知药品",
                    "specification": med.specification if med else "",
                    "manufacturer": med.manufacturer if med else ""
                },
                "unit_price": i.price_at_time,
                "quantity": i.quantity
            })
        
        # 映射状态
        # PrescriptionStatus: pending, paid, dispensed, cancelled
        # Order Status: pending_payment, paid, shipped, completed, cancelled
        status = "pending_payment"
        payment_status = "unpaid"
        delivery_type = "express" # 默认快递

        if p.status == models.PrescriptionStatus.pending:
            status = "pending_payment"
            payment_status = "unpaid"
        elif p.status == models.PrescriptionStatus.paid:
            status = "paid"
            payment_status = "paid"
        elif p.status == models.PrescriptionStatus.dispensed:
            status = "completed"
            payment_status = "paid"
        elif p.status == models.PrescriptionStatus.cancelled:
            status = "cancelled"
            payment_status = "unpaid" # or refunded

        # 获取患者信息
        patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == p.patient_id).first()
        patient_user = db.query(models.User).filter(models.User.id == p.patient_id).first()
        
        receiver_name = patient_profile.name if patient_profile else "用户"
        receiver_phone = patient_user.phone if patient_user else ""

        results.append({
            "id": p.id,
            "order_number": f"ORD{p.created_at.strftime('%Y%m%d')}{p.id:04d}",
            "order_items": order_items,
            "total_amount": p.total_price,
            "delivery_type": delivery_type,
            "status": status,
            "payment_status": payment_status,
            "created_at": p.created_at.isoformat(),
            "receiver_name": receiver_name,
            "receiver_phone": receiver_phone,
            "receiver_address": "医院药房自提", # 暂时默认自提
        })
    
    return results
