-- 创建RLS策略

-- 用户只能查看自己的信息
CREATE POLICY "users_view_own_profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- 用户只能更新自己的信息
CREATE POLICY "users_update_own_profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- 患者只能查看自己的预约
CREATE POLICY "patients_view_own_appointments" ON appointments
    FOR SELECT USING (auth.uid() = patient_id);

-- 医生可以查看自己的预约
CREATE POLICY "doctors_view_own_appointments" ON appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'doctor'
            AND appointments.doctor_id = auth.uid()
        )
    );

-- 患者只能查看自己的药单
CREATE POLICY "patients_view_own_prescriptions" ON prescriptions
    FOR SELECT USING (auth.uid() = patient_id);

-- 医生可以查看自己开具的药单
CREATE POLICY "doctors_view_own_prescriptions" ON prescriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'doctor'
            AND prescriptions.doctor_id = auth.uid()
        )
    );

-- 医生只能管理自己的排班
CREATE POLICY "doctors_manage_own_schedules" ON schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'doctor'
            AND schedules.doctor_id = auth.uid()
        )
    );

-- 药房工作人员可以管理药品库存
CREATE POLICY "pharmacists_manage_medicines" ON medicines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'pharmacist'
        )
    );

-- 管理员可以管理所有数据
CREATE POLICY "admins_manage_all" ON users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "admins_manage_appointments" ON appointments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "admins_manage_prescriptions" ON prescriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;