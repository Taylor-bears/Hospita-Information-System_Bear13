import sys
import os
import random
import json
from datetime import date, timedelta, time, datetime
from faker import Faker
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# 添加当前目录到 sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

try:
    from database import SessionLocal, engine, Base
    import models
except ImportError:
    # Fallback for direct execution
    sys.path.append(os.path.join(current_dir, '..'))
    from backend.database import SessionLocal, engine, Base
    from backend import models

# 初始化 Faker
fake = Faker('zh_CN')

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def init_db():
    models.Base.metadata.create_all(bind=engine)

def seed_from_json(db: Session, json_path: str = "initial_data.json"):
    """从 JSON 文件加载初始数据"""
    full_path = os.path.join(os.path.dirname(__file__), json_path)
    if not os.path.exists(full_path):
        print(f"未找到初始数据文件: {full_path}，跳过 JSON 初始化。")
        return

    print(f"正在从 {json_path} 加载初始数据...")
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"读取 JSON 文件失败: {e}")
        return

    # 1. 处理用户 (Users)
    if "users" in data:
        for user_data in data["users"]:
            phone = user_data["phone"]
            existing_user = db.query(models.User).filter(models.User.phone == phone).first()
            if not existing_user:
                role_enum = models.UserRole(user_data["role"])
                new_user = models.User(
                    phone=phone,
                    password=get_password_hash(user_data["password"]),
                    role=role_enum,
                    status=models.UserStatus.active
                )
                db.add(new_user)
                db.flush()
                print(f"  已创建用户: {phone} ({user_data['role']})")

                profile_data = user_data.get("profile") or {}
                if role_enum == models.UserRole.doctor:
                    profile = models.DoctorProfile(
                        user_id=new_user.id,
                        name=profile_data.get("name"),
                        department=profile_data.get("department"),
                        title=profile_data.get("title"),
                        license_number=profile_data.get("license_number"),
                        hospital=profile_data.get("hospital"),
                        email=profile_data.get("email")
                    )
                    db.add(profile)
                elif role_enum == models.UserRole.user:
                    profile = models.PatientProfile(
                        user_id=new_user.id,
                        name=profile_data.get("name"),
                        id_card=profile_data.get("id_card"),
                        email=profile_data.get("email")
                    )
                    db.add(profile)
                elif role_enum == models.UserRole.pharmacist:
                    profile = models.PharmacistProfile(
                        user_id=new_user.id,
                        name=profile_data.get("name") or user_data.get("description") or phone,
                        department=profile_data.get("department"),
                        title=profile_data.get("title"),
                        license_number=profile_data.get("license_number"),
                        email=profile_data.get("email"),
                    )
                    db.add(profile)
            else:
                print(f"  用户已存在: {phone}，跳过。")

    # 2. 处理药品 (Medications)
    if "medications" in data:
        for med_data in data["medications"]:
            name = med_data["name"]
            existing_med = db.query(models.Medication).filter(models.Medication.name == name).first()
            if not existing_med:
                new_med = models.Medication(
                    name=name,
                    category=med_data.get("category"),
                    specification=med_data.get("specification"),
                    unit=med_data.get("unit"),
                    manufacturer=med_data.get("manufacturer"),
                    stock=med_data.get("stock", 0),
                    min_stock=med_data.get("min_stock", 10),
                    price=med_data.get("price", 0),
                    description=med_data.get("description"),
                    status=models.MedicationStatus.active
                )
                db.add(new_med)
                print(f"  已创建药品: {name}")
            else:
                # 如果药品已存在，更新价格（支持数据修正）
                if "price" in med_data:
                    existing_med.price = med_data["price"]
                    print(f"  药品已存在: {name}，已更新价格为 {med_data['price']}")
                else:
                    print(f"  药品已存在: {name}，跳过。")

    # 3. 处理病历与处方 (Medical Records & Prescriptions)
    if "medical_records" in data:
        print("  正在处理病历数据...")
        for record_data in data["medical_records"]:
            # 查找患者和医生
            patient = db.query(models.User).filter(models.User.phone == record_data["patient_phone"]).first()
            doctor = db.query(models.User).filter(models.User.phone == record_data["doctor_phone"]).first()
            
            if not patient or not doctor:
                print(f"  无法找到患者({record_data.get('patient_phone')})或医生({record_data.get('doctor_phone')})，跳过病历。")
                continue

            # 创建病历
            created_at = datetime.now()
            if "created_at" in record_data:
                try:
                    created_at = datetime.strptime(record_data["created_at"], "%Y-%m-%d %H:%M:%S")
                except:
                    pass

            new_record = models.MedicalRecord(
                patient_id=patient.id,
                doctor_id=doctor.id,
                diagnosis=record_data["diagnosis"],
                treatment=record_data.get("treatment"),
                status=models.MedicalRecordStatus.active,
                created_at=created_at
            )
            db.add(new_record)
            db.flush()

            # 处理处方
            if "prescriptions" in record_data:
                for pres_data in record_data["prescriptions"]:
                    new_pres = models.Prescription(
                        medical_record_id=new_record.id,
                        doctor_id=doctor.id,
                        patient_id=patient.id,
                        status=models.PrescriptionStatus(pres_data.get("status", "pending")),
                        notes=pres_data.get("notes"),
                        created_at=created_at
                    )
                    db.add(new_pres)
                    db.flush()

                    total_price = 0
                    if "items" in pres_data:
                        for item_data in pres_data["items"]:
                            med = db.query(models.Medication).filter(models.Medication.name == item_data["medication_name"]).first()
                            if med:
                                quantity = item_data.get("quantity", 1)
                                price = med.price
                                total_price += price * quantity
                                
                                new_item = models.PrescriptionItem(
                                    prescription_id=new_pres.id,
                                    medication_id=med.id,
                                    quantity=quantity,
                                    price_at_time=price,
                                    usage_instruction=item_data.get("usage")
                                )
                                db.add(new_item)
                    
                    new_pres.total_price = total_price

    db.commit()
    print("JSON 数据加载完成。")

def seed_faker_data(db: Session):
    """生成随机测试数据 (Faker)"""
    print("正在检查并生成随机测试数据...")
    
    # 1. 医生 (Doctor) - 确保至少有 10 个医生
    departments = ["心内科", "呼吸内科", "普外科", "骨科", "儿科", "妇科", "眼科", "口腔科", "皮肤科", "中医科"]
    titles = ["主任医师", "副主任医师", "主治医师", "住院医师"]
    
    current_doctor_count = db.query(models.User).filter(models.User.role == models.UserRole.doctor).count()
    
    if current_doctor_count < 10:
        print(f"  当前医生数量 ({current_doctor_count}) 不足 10，正在补充...")
        for i in range(10 - current_doctor_count):
            phone = f"136{str(i + current_doctor_count + 100).zfill(8)}" # 避免冲突
            new_user = models.User(
                phone=phone,
                password=get_password_hash("123456"),
                role=models.UserRole.doctor,
                status=models.UserStatus.active
            )
            db.add(new_user)
            db.flush()
            
            profile = models.DoctorProfile(
                user_id=new_user.id,
                name=fake.name(),
                department=random.choice(departments),
                title=random.choice(titles),
                license_number=fake.bothify(text='DOC##########'),
                hospital="市中心医院",
                email=fake.email()
            )
            db.add(profile)
    
    # 获取所有医生用于排班
    all_doctors = db.query(models.User).filter(models.User.role == models.UserRole.doctor).all()

    # 2. 患者 (User) - 确保至少有 20 个患者
    current_patient_count = db.query(models.User).filter(models.User.role == models.UserRole.user).count()
    
    if current_patient_count < 20:
        print(f"  当前患者数量 ({current_patient_count}) 不足 20，正在补充...")
        for i in range(20 - current_patient_count):
            phone = f"135{str(i + current_patient_count + 100).zfill(8)}"
            new_user = models.User(
                phone=phone,
                password=get_password_hash("123456"),
                role=models.UserRole.user,
                status=models.UserStatus.active
            )
            db.add(new_user)
            db.flush()
            
            profile = models.PatientProfile(
                user_id=new_user.id,
                name=fake.name(),
                id_card=fake.ssn(),
                email=fake.email()
            )
            db.add(profile)

    db.commit()
    
    # 3. 排班 (Schedules)
    print("  正在生成排班数据...")
    today = date.today()
    for doctor in all_doctors:
        for i in range(7):
            current_date = today + timedelta(days=i)
            if random.random() > 0.3: # 70% 概率排班
                # AM
                if not db.query(models.DoctorSchedule).filter(models.DoctorSchedule.doctor_id == doctor.id, models.DoctorSchedule.date == current_date, models.DoctorSchedule.start_time == time(8, 0)).first():
                    db.add(models.DoctorSchedule(
                        doctor_id=doctor.id, date=current_date, start_time=time(8, 0), end_time=time(12, 0),
                        capacity=random.randint(10, 20), status=models.ScheduleStatus.open
                    ))
                # PM
                if not db.query(models.DoctorSchedule).filter(models.DoctorSchedule.doctor_id == doctor.id, models.DoctorSchedule.date == current_date, models.DoctorSchedule.start_time == time(14, 0)).first():
                    db.add(models.DoctorSchedule(
                        doctor_id=doctor.id, date=current_date, start_time=time(14, 0), end_time=time(17, 0),
                        capacity=random.randint(10, 20), status=models.ScheduleStatus.open
                    ))
    db.commit()
    print("Faker 数据补充完成。")

def main():
    db = SessionLocal()
    try:
        init_db()
        seed_from_json(db)
        seed_faker_data(db)
        print("\n✅ 所有数据初始化成功！")
    except Exception as e:
        print(f"\n❌ 数据初始化失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
