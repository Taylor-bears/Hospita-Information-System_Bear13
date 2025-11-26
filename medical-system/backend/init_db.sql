-- 创建数据库
CREATE DATABASE IF NOT EXISTS medical_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE medical_db;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'doctor', 'user') NOT NULL,
    status ENUM('active', 'pending') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认管理员账号 (密码: admin123)
-- 注意：实际生产环境中密码应该是哈希过的，这里为了演示方便，后端代码会处理哈希，
-- 或者我们可以直接插入一个已知哈希值的管理员。
-- 这里我们先不插入，让后端初始化时检查并插入，或者让用户手动注册一个管理员（不推荐），
-- 最好的方式是后端启动脚本里自动创建默认管理员。
