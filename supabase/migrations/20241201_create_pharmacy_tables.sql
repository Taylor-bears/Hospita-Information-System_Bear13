-- 药房管理系统数据库表结构
-- 创建用户表（扩展自Supabase auth.users）
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(11) UNIQUE NOT NULL CHECK (phone ~ '^[0-9]{11}$'),
    email VARCHAR(255) UNIQUE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'pharmacy_manager', 'pharmacy_staff', 'doctor', 'patient')),
    profile JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建医生信息表
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(100) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    hospital VARCHAR(255),
    schedule JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建药品表
CREATE TABLE IF NOT EXISTS drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    manufacturer VARCHAR(255),
    specification VARCHAR(255),
    category VARCHAR(100),
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(50),
    is_prescription BOOLEAN DEFAULT false,
    barcode VARCHAR(255) UNIQUE,
    description TEXT,
    storage_conditions VARCHAR(255),
    approval_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建库存表
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drug_id UUID REFERENCES drugs(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_stock INTEGER DEFAULT 10,
    max_stock INTEGER DEFAULT 1000,
    batch_number VARCHAR(100),
    expiry_date DATE,
    location VARCHAR(255),
    supplier VARCHAR(255),
    purchase_price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建库存变动记录表
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('inbound', 'outbound', 'adjustment', 'expired')),
    quantity INTEGER NOT NULL,
    balance INTEGER NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    reason TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建处方表
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_number VARCHAR(100) UNIQUE NOT NULL,
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'audited', 'dispensing', 'dispensed', 'delivered', 'cancelled')),
    diagnosis TEXT,
    symptoms TEXT,
    total_amount DECIMAL(10,2) DEFAULT 0,
    insurance_info JSONB DEFAULT '{}',
    notes TEXT,
    prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建处方明细表
CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
    drug_id UUID REFERENCES drugs(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建预约表
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_number VARCHAR(100) UNIQUE NOT NULL,
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    appointment_date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
    symptoms TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    patient_id UUID REFERENCES users(id),
    prescription_id UUID REFERENCES prescriptions(id),
    order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('prescription', 'otc', 'appointment')),
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    delivery_type VARCHAR(50) CHECK (delivery_type IN ('pickup', 'delivery')),
    delivery_address JSONB DEFAULT '{}',
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建订单明细表
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    drug_id UUID REFERENCES drugs(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_license ON doctors(license_number);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_is_active ON doctors(is_active);

CREATE INDEX IF NOT EXISTS idx_drugs_name ON drugs(name);
CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name);
CREATE INDEX IF NOT EXISTS idx_drugs_category ON drugs(category);
CREATE INDEX IF NOT EXISTS idx_drugs_barcode ON drugs(barcode);
CREATE INDEX IF NOT EXISTS idx_drugs_is_prescription ON drugs(is_prescription);

CREATE INDEX IF NOT EXISTS idx_inventory_drug_id ON inventory(drug_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_batch_number ON inventory(batch_number);

CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescription_number ON prescriptions(prescription_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_drug_id ON prescription_items(drug_id);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_number ON appointments(appointment_number);

CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_prescription_id ON orders(prescription_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_drug_id ON order_items(drug_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 插入默认系统配置
INSERT INTO system_settings (key, value, description) VALUES
('pharmacy_name', '{"value": "惠民药房"}', '药房名称'),
('pharmacy_address', '{"value": "北京市朝阳区健康路123号"}', '药房地址'),
('pharmacy_phone', '{"value": "010-12345678"}', '药房电话'),
('low_stock_threshold', '{"value": 10}', '低库存预警阈值'),
('expiry_warning_days', '{"value": 30}', '过期预警天数'),
('appointment_time_slots', '{"value": ["09:00-09:30", "09:30-10:00", "10:00-10:30", "10:30-11:00", "11:00-11:30", "14:00-14:30", "14:30-15:00", "15:00-15:30", "15:30-16:00", "16:00-16:30"]}', '预约时间段'),
('delivery_fee', '{"value": 10}', '配送费用'),
('free_delivery_threshold', '{"value": 100}', '免配送费门槛');

-- 插入默认管理员用户
INSERT INTO users (phone, email, name, role, profile) VALUES
('admin@pharmacy.com', 'admin@pharmacy.com', '系统管理员', 'admin', '{"is_default": true}');

-- 插入默认药品分类
INSERT INTO system_settings (key, value, description) VALUES
('drug_categories', '{"value": ["感冒药", "消炎药", "止痛药", "维生素", "中成药", "外用药", "保健品", "医疗器械", "处方药", "非处方药"]}', '药品分类');

-- 启用RLS（行级安全）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 用户只能查看自己的信息
CREATE POLICY users_own_data ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_all_data ON users FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 医生信息访问策略
CREATE POLICY doctors_public_read ON doctors FOR SELECT USING (true);
CREATE POLICY doctors_own_data ON doctors FOR ALL USING (auth.uid() = user_id);
CREATE POLICY doctors_admin_data ON doctors FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 药品信息公开访问
CREATE POLICY drugs_public_read ON drugs FOR SELECT USING (true);
CREATE POLICY drugs_admin_write ON drugs FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));

-- 库存管理策略
CREATE POLICY inventory_pharmacy_read ON inventory FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));
CREATE POLICY inventory_pharmacy_write ON inventory FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));

-- 处方访问策略
CREATE POLICY prescriptions_patient_read ON prescriptions FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY prescriptions_doctor_read ON prescriptions FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY prescriptions_pharmacy_read ON prescriptions FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));
CREATE POLICY prescriptions_pharmacy_write ON prescriptions FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));

-- 预约访问策略
CREATE POLICY appointments_patient_read ON appointments FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY appointments_doctor_read ON appointments FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY appointments_patient_write ON appointments FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY appointments_admin_write ON appointments FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'doctor'));

-- 订单访问策略
CREATE POLICY orders_patient_read ON orders FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY orders_patient_write ON orders FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY orders_pharmacy_read ON orders FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));
CREATE POLICY orders_pharmacy_write ON orders FOR ALL USING (auth.jwt() ->> 'role' IN ('admin', 'pharmacy_manager', 'pharmacy_staff'));

-- 系统配置公开读取
CREATE POLICY system_settings_public_read ON system_settings FOR SELECT USING (true);
CREATE POLICY system_settings_admin_write ON system_settings FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- 授予权限
GRANT SELECT ON users TO anon;
GRANT SELECT ON drugs TO anon;
GRANT SELECT ON doctors TO anon;
GRANT SELECT ON appointments TO anon;
GRANT SELECT ON system_settings TO anon;

GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT ALL PRIVILEGES ON doctors TO authenticated;
GRANT ALL PRIVILEGES ON drugs TO authenticated;
GRANT ALL PRIVILEGES ON inventory TO authenticated;
GRANT ALL PRIVILEGES ON stock_movements TO authenticated;
GRANT ALL PRIVILEGES ON prescriptions TO authenticated;
GRANT ALL PRIVILEGES ON prescription_items TO authenticated;
GRANT ALL PRIVILEGES ON appointments TO authenticated;
GRANT ALL PRIVILEGES ON orders TO authenticated;
GRANT ALL PRIVILEGES ON order_items TO authenticated;
GRANT ALL PRIVILEGES ON audit_logs TO authenticated;
GRANT ALL PRIVILEGES ON system_settings TO authenticated;
