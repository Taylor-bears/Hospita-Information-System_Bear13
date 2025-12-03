-- 创建排班表
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_appointments INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建库存日志表
CREATE TABLE inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
    change_quantity INTEGER NOT NULL,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('stock_in', 'stock_out', 'adjustment')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_schedules_doctor_id ON schedules(doctor_id);
CREATE INDEX idx_schedules_work_date ON schedules(work_date);
CREATE INDEX idx_inventory_logs_medicine_id ON inventory_logs(medicine_id);

-- 设置权限
GRANT SELECT ON schedules TO anon;
GRANT ALL PRIVILEGES ON schedules TO authenticated;
GRANT SELECT ON inventory_logs TO anon;
GRANT ALL PRIVILEGES ON inventory_logs TO authenticated;