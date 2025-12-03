-- 医院系统数据库表结构
-- 基于技术架构文档创建

-- 用户表 (users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin', 'pharmacist')),
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_approved ON users(is_approved);

-- 医生表 (doctors)
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    title VARCHAR(100) NOT NULL,
    qualifications TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_department ON doctors(department);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);

-- 预约表 (appointments)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 药单表 (prescriptions)
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prescribed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'dispensed')),
    total_amount DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- 药单项表 (prescription_items)
CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_medicine_id ON prescription_items(medicine_id);

-- 药品表 (medicines)
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    manufacturer VARCHAR(200),
    specifications VARCHAR(500),
    usage_instructions TEXT,
    side_effects TEXT,
    contraindications TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(is_active);

-- 医生排班表 (schedules)
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_appointments INTEGER DEFAULT 10,
    current_appointments INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_schedules_doctor_id ON schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_work_date ON schedules(work_date);
CREATE INDEX IF NOT EXISTS idx_schedules_available ON schedules(is_available);

-- 库存日志表 (inventory_logs)
CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    change_quantity INTEGER NOT NULL,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('stock_in', 'stock_out', 'adjustment', 'prescription')),
    reason TEXT,
    reference_id UUID, -- 关联到订单或处方ID
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inventory_logs_medicine_id ON inventory_logs(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_operation_type ON inventory_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);

-- 订单表 (orders)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES prescriptions(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled')),
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    shipping_address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_prescription_id ON orders(prescription_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 订单项表 (order_items)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_medicine_id ON order_items(medicine_id);

-- 支付记录表 (payment_records)
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);

-- 医疗记录表 (medical_records)
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    prescription_id UUID REFERENCES prescriptions(id),
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_id ON medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_appointment_id ON medical_records(appointment_id);

-- 设置基本权限
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 创建行级安全策略 (RLS)

-- 用户表策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 患者只能查看自己的信息
CREATE POLICY "patients_view_own_profile" ON users
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('doctor', 'admin', 'pharmacist')
        )
    );

-- 医生只能查看患者和自己的信息
CREATE POLICY "doctors_view_patients_and_self" ON users
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'doctor'
        ) OR
        EXISTS (
            SELECT 1 FROM appointments 
            WHERE appointments.doctor_id = auth.uid() 
            AND appointments.patient_id = users.id
        )
    );

-- 管理员可以查看所有用户信息
CREATE POLICY "admin_view_all_users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 预约表策略
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 患者只能查看自己的预约
CREATE POLICY "patients_view_own_appointments" ON appointments
    FOR SELECT USING (
        auth.uid() = patient_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'doctor'
        )
    );

-- 医生只能查看自己的预约
CREATE POLICY "doctors_view_own_appointments" ON appointments
    FOR SELECT USING (
        auth.uid() = doctor_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 药单表策略
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- 患者只能查看自己的药单
CREATE POLICY "patients_view_own_prescriptions" ON prescriptions
    FOR SELECT USING (
        auth.uid() = patient_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'doctor'
        )
    );

-- 医生只能查看自己开具的药单
CREATE POLICY "doctors_view_own_prescriptions" ON prescriptions
    FOR SELECT USING (
        auth.uid() = doctor_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 药品表策略
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

-- 所有用户都可以查看药品信息
CREATE POLICY "all_users_view_medicines" ON medicines
    FOR SELECT USING (is_active = true);

-- 药房工作人员可以管理药品
CREATE POLICY "pharmacists_manage_medicines" ON medicines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'pharmacist'
        )
    );

-- 管理员可以管理所有药品
CREATE POLICY "admin_manage_medicines" ON medicines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 医生表策略
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- 所有用户都可以查看医生信息
CREATE POLICY "all_users_view_doctors" ON doctors
    FOR SELECT USING (is_active = true);

-- 排班表策略
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- 所有用户都可以查看排班信息
CREATE POLICY "all_users_view_schedules" ON schedules
    FOR SELECT USING (is_available = true);

-- 医生只能管理自己的排班
CREATE POLICY "doctors_manage_own_schedules" ON schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM doctors 
            WHERE doctors.user_id = auth.uid() 
            AND doctors.id = schedules.doctor_id
        )
    );

-- 管理员可以管理所有排班
CREATE POLICY "admin_manage_schedules" ON schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 插入测试数据
INSERT INTO medicines (name, category, description, price, stock_quantity, manufacturer, is_active) VALUES
('阿莫西林胶囊', '抗生素', '广谱抗生素，用于治疗细菌感染', 25.50, 100, '华北制药', true),
('布洛芬片', '解热镇痛', '用于缓解轻至中度疼痛和发热', 15.80, 200, '石药集团', true),
('维生素C片', '维生素', '补充维生素C，增强免疫力', 8.90, 300, '东北制药', true),
('奥美拉唑胶囊', '消化系统', '用于治疗胃溃疡、十二指肠溃疡', 45.60, 80, '扬子江药业', true),
('复方甘草片', '呼吸系统', '用于镇咳祛痰', 12.30, 150, '同仁堂', true);

-- 插入测试医生数据（需要先注册用户）
-- 注意：实际使用时需要先注册用户，然后才能插入对应的医生数据