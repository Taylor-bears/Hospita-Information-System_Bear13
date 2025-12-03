const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 8000;
const JWT_SECRET = 'medical-system-secret-key';

// 中间件
app.use(cors());
app.use(express.json());

// 创建数据库连接
const db = new sqlite3.Database('./medical.db');

// 创建表
db.serialize(() => {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'user')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 医生排班表
  db.run(`CREATE TABLE IF NOT EXISTS doctor_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    booked_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES users(id)
  )`);

  // 预约表
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id),
    FOREIGN KEY (doctor_id) REFERENCES users(id),
    FOREIGN KEY (schedule_id) REFERENCES doctor_schedules(id)
  )`);

  // 插入默认管理员
  const adminPassword = bcrypt.hashSync('admin', 10);
  db.run(`INSERT OR IGNORE INTO users (phone, password, role, status) VALUES (?, ?, 'admin', 'active')`, 
    ['13800138000', adminPassword]);

  // 插入测试医生
  const doctorPassword = bcrypt.hashSync('doctor123', 10);
  db.run(`INSERT OR IGNORE INTO users (phone, password, role, status) VALUES (?, ?, 'doctor', 'active')`, 
    ['15000000001', doctorPassword]);

  // 插入测试患者
  const patientPassword = bcrypt.hashSync('patient123', 10);
  db.run(`INSERT OR IGNORE INTO users (phone, password, role, status) VALUES (?, ?, 'user', 'active')`, 
    ['15000000002', patientPassword]);

  // 插入测试排班
  db.run(`INSERT OR IGNORE INTO doctor_schedules (doctor_id, date, start_time, end_time, capacity, booked_count, status) 
    VALUES (1, '2025-12-03', '09:00', '09:30', 2, 0, 'open')`);
  db.run(`INSERT OR IGNORE INTO doctor_schedules (doctor_id, date, start_time, end_time, capacity, booked_count, status) 
    VALUES (1, '2025-12-03', '10:00', '10:30', 1, 0, 'open')`);
});

// 登录接口
app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  
  db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    
    if (!user) {
      return res.status(400).json({ detail: '手机号或密码错误' });
    }
    
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ detail: '手机号或密码错误' });
    }
    
    if (user.status === 'pending') {
      return res.status(403).json({ detail: '账号审核中，请等待管理员审核' });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      access_token: token,
      token_type: 'bearer',
      role: user.role,
      status: user.status
    });
  });
});

// 注册接口
app.post('/register', (req, res) => {
  const { phone, password, role } = req.body;
  
  if (role === 'admin') {
    return res.status(400).json({ detail: '无法注册管理员账号' });
  }
  
  db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    
    if (existingUser) {
      return res.status(400).json({ detail: '该手机号已被注册' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const status = role === 'doctor' ? 'pending' : 'active';
    
    db.run('INSERT INTO users (phone, password, role, status) VALUES (?, ?, ?, ?)', 
      [phone, hashedPassword, role, status], function(err) {
      if (err) {
        return res.status(500).json({ detail: '注册失败' });
      }
      
      res.json({
        id: this.lastID,
        phone: phone,
        role: role,
        status: status
      });
    });
  });
});

// 获取可预约医生列表
app.get('/appointments/doctors', (req, res) => {
  db.all(`
    SELECT u.id, u.phone, 
           (SELECT COUNT(*) FROM doctor_schedules ds 
            WHERE ds.doctor_id = u.id AND ds.status = 'open' AND ds.capacity > ds.booked_count) as available_schedules
    FROM users u 
    WHERE u.role = 'doctor' AND u.status = 'active'
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    res.json(rows);
  });
});

// 获取医生的可用排班
app.get('/appointments/doctor/:doctorId/schedules', (req, res) => {
  const doctorId = req.params.doctorId;
  const date = req.query.date;
  
  let query = `
    SELECT ds.* FROM doctor_schedules ds
    WHERE ds.doctor_id = ? AND ds.status = 'open' AND ds.capacity > ds.booked_count
  `;
  let params = [doctorId];
  
  if (date) {
    query += ' AND ds.date = ?';
    params.push(date);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    res.json(rows);
  });
});

// 创建预约
app.post('/appointments', (req, res) => {
  const { patient_id, doctor_id, schedule_id } = req.body;
  
  // 检查患者是否存在且激活
  db.get('SELECT * FROM users WHERE id = ? AND role = ? AND status = ?', 
    [patient_id, 'user', 'active'], (err, patient) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    if (!patient) {
      return res.status(400).json({ detail: '患者不存在或账号未激活' });
    }
    
    // 检查医生是否存在且激活
    db.get('SELECT * FROM users WHERE id = ? AND role = ? AND status = ?', 
      [doctor_id, 'doctor', 'active'], (err, doctor) => {
      if (err) {
        return res.status(500).json({ detail: '数据库错误' });
      }
      if (!doctor) {
        return res.status(400).json({ detail: '医生不存在或未激活' });
      }
      
      // 检查排班是否存在且开放
      db.get('SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND status = ?', 
        [schedule_id, doctor_id, 'open'], (err, schedule) => {
        if (err) {
          return res.status(500).json({ detail: '数据库错误' });
        }
        if (!schedule) {
          return res.status(400).json({ detail: '排班不存在或未开放' });
        }
        
        // 检查容量
        if (schedule.booked_count >= schedule.capacity) {
          return res.status(400).json({ detail: '排班容量不足' });
        }
        
        // 检查是否已预约
        db.get('SELECT * FROM appointments WHERE patient_id = ? AND schedule_id = ? AND status != ?', 
          [patient_id, schedule_id, 'cancelled'], (err, existingAppointment) => {
          if (err) {
            return res.status(500).json({ detail: '数据库错误' });
          }
          if (existingAppointment) {
            return res.json(existingAppointment);
          }
          
          // 创建预约并更新排班计数
          db.run('BEGIN TRANSACTION', () => {
            db.run('INSERT INTO appointments (patient_id, doctor_id, schedule_id, status) VALUES (?, ?, ?, ?)', 
              [patient_id, doctor_id, schedule_id, 'confirmed'], function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ detail: '预约失败' });
              }
              
              db.run('UPDATE doctor_schedules SET booked_count = booked_count + 1 WHERE id = ?', 
                [schedule_id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ detail: '更新排班失败' });
                }
                
                db.run('COMMIT', () => {
                  res.json({
                    id: this.lastID,
                    patient_id: patient_id,
                    doctor_id: doctor_id,
                    schedule_id: schedule_id,
                    status: 'confirmed'
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// 获取我的预约
app.get('/appointments/my', (req, res) => {
  const patientId = req.query.patient_id;
  
  db.all('SELECT * FROM appointments WHERE patient_id = ?', [patientId], (err, rows) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    res.json(rows);
  });
});

// 取消预约
app.post('/appointments/:id/cancel', (req, res) => {
  const appointmentId = req.params.id;
  const patientId = req.query.patient_id;
  
  db.get('SELECT * FROM appointments WHERE id = ? AND patient_id = ?', 
    [appointmentId, patientId], (err, appointment) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    if (!appointment) {
      return res.status(404).json({ detail: '预约不存在或无权限' });
    }
    if (appointment.status === 'cancelled') {
      return res.json({ message: '已取消' });
    }
    
    db.run('BEGIN TRANSACTION', () => {
      db.run('UPDATE appointments SET status = ? WHERE id = ?', ['cancelled', appointmentId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ detail: '取消预约失败' });
        }
        
        db.run('UPDATE doctor_schedules SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', 
          [appointment.schedule_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ detail: '更新排班失败' });
          }
          
          db.run('COMMIT', () => {
            res.json({ message: '已取消' });
          });
        });
      });
    });
  });
});

// 医生获取自己的排班
app.get('/doctor/schedules/my', (req, res) => {
  const doctorId = req.query.doctor_id;
  
  db.all('SELECT * FROM doctor_schedules WHERE doctor_id = ? ORDER BY date, start_time', [doctorId], (err, rows) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    res.json(rows);
  });
});

// 医生创建排班
app.post('/doctor/schedules', (req, res) => {
  const { doctor_id, date, start_time, end_time, capacity } = req.body;
  
  db.get('SELECT * FROM users WHERE id = ? AND role = ? AND status = ?', 
    [doctor_id, 'doctor', 'active'], (err, doctor) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    if (!doctor) {
      return res.status(400).json({ detail: '医生不存在或未激活' });
    }
    
    db.run('INSERT INTO doctor_schedules (doctor_id, date, start_time, end_time, capacity, status) VALUES (?, ?, ?, ?, ?, ?)', 
      [doctor_id, date, start_time, end_time, capacity, 'open'], function(err) {
      if (err) {
        return res.status(500).json({ detail: '创建排班失败' });
      }
      
      res.json({
        id: this.lastID,
        doctor_id: doctor_id,
        date: date,
        start_time: start_time,
        end_time: end_time,
        capacity: capacity,
        booked_count: 0,
        status: 'open'
      });
    });
  });
});

// 医生删除排班
app.delete('/doctor/schedules/:id', (req, res) => {
  const scheduleId = req.params.id;
  const doctorId = req.query.doctor_id;
  
  db.get('SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ?', [scheduleId, doctorId], (err, schedule) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    if (!schedule) {
      return res.status(404).json({ detail: '排班不存在或无权限' });
    }
    
    // 检查是否已有预约
    db.get('SELECT COUNT(*) as count FROM appointments WHERE schedule_id = ? AND status != ?', 
      [scheduleId, 'cancelled'], (err, result) => {
      if (err) {
        return res.status(500).json({ detail: '数据库错误' });
      }
      if (result.count > 0) {
        return res.status(400).json({ detail: '该排班已有预约，不可删除' });
      }
      
      db.run('DELETE FROM doctor_schedules WHERE id = ?', [scheduleId], (err) => {
        if (err) {
          return res.status(500).json({ detail: '删除排班失败' });
        }
        res.json({ message: '已删除' });
      });
    });
  });
});

// 医生获取自己的预约
app.get('/doctor/appointments/my', (req, res) => {
  const doctorId = req.query.doctor_id;
  
  db.all('SELECT * FROM appointments WHERE doctor_id = ?', [doctorId], (err, rows) => {
    if (err) {
      return res.status(500).json({ detail: '数据库错误' });
    }
    res.json(rows);
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'Medical System API is running',
    version: '1.0.0',
    modules: ['login', 'appointments', 'doctor']
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});