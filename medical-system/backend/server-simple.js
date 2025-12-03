const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 8000;

// 中间件
app.use(cors());
app.use(express.json());

// 内存数据库
const users = [
  { id: 1, phone: '13800138000', password: bcrypt.hashSync('admin', 10), role: 'admin', status: 'active' },
  { id: 2, phone: '15000000001', password: bcrypt.hashSync('doctor123', 10), role: 'doctor', status: 'active' },
  { id: 3, phone: '15000000002', password: bcrypt.hashSync('patient123', 10), role: 'user', status: 'active' }
];

const doctorSchedules = [
  { id: 1, doctor_id: 2, date: '2025-12-03', start_time: '09:00', end_time: '09:30', capacity: 2, booked_count: 0, status: 'open' },
  { id: 2, doctor_id: 2, date: '2025-12-03', start_time: '10:00', end_time: '10:30', capacity: 1, booked_count: 0, status: 'open' }
];

const appointments = [];

let nextUserId = 4;
let nextScheduleId = 3;
let nextAppointmentId = 1;

// 登录接口
app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  
  const user = users.find(u => u.phone === phone);
  if (!user) {
    return res.status(400).json({ detail: '手机号或密码错误' });
  }
  
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ detail: '手机号或密码错误' });
  }
  
  if (user.status === 'pending') {
    return res.status(403).json({ detail: '账号审核中，请等待管理员审核' });
  }
  
  res.json({
    access_token: 'fake-jwt-token',
    token_type: 'bearer',
    role: user.role,
    status: user.status
  });
});

// 注册接口
app.post('/register', (req, res) => {
  const { phone, password, role } = req.body;
  
  if (role === 'admin') {
    return res.status(400).json({ detail: '无法注册管理员账号' });
  }
  
  const existingUser = users.find(u => u.phone === phone);
  if (existingUser) {
    return res.status(400).json({ detail: '该手机号已被注册' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  const status = role === 'doctor' ? 'pending' : 'active';
  
  const newUser = {
    id: nextUserId++,
    phone,
    password: hashedPassword,
    role,
    status
  };
  
  users.push(newUser);
  
  res.json({
    id: newUser.id,
    phone: newUser.phone,
    role: newUser.role,
    status: newUser.status
  });
});

// 获取可预约医生列表
app.get('/appointments/doctors', (req, res) => {
  const result = users
    .filter(u => u.role === 'doctor' && u.status === 'active')
    .map(doctor => {
      const availableCount = doctorSchedules.filter(
        ds => ds.doctor_id === doctor.id && ds.status === 'open' && ds.capacity > ds.booked_count
      ).length;
      
      return {
        id: doctor.id,
        phone: doctor.phone,
        available_schedules: availableCount
      };
    });
  
  res.json(result);
});

// 获取医生的可用排班
app.get('/appointments/doctor/:doctorId/schedules', (req, res) => {
  const doctorId = parseInt(req.params.doctorId);
  const date = req.query.date;
  
  let result = doctorSchedules.filter(
    ds => ds.doctor_id === doctorId && ds.status === 'open' && ds.capacity > ds.booked_count
  );
  
  if (date) {
    result = result.filter(ds => ds.date === date);
  }
  
  res.json(result);
});

// 创建预约
app.post('/appointments', (req, res) => {
  const { patient_id, doctor_id, schedule_id } = req.body;
  
  // 检查患者
  const patient = users.find(u => u.id === patient_id && u.role === 'user' && u.status === 'active');
  if (!patient) {
    return res.status(400).json({ detail: '患者不存在或账号未激活' });
  }
  
  // 检查医生
  const doctor = users.find(u => u.id === doctor_id && u.role === 'doctor' && u.status === 'active');
  if (!doctor) {
    return res.status(400).json({ detail: '医生不存在或未激活' });
  }
  
  // 检查排班
  const schedule = doctorSchedules.find(ds => ds.id === schedule_id && ds.doctor_id === doctor_id && ds.status === 'open');
  if (!schedule) {
    return res.status(400).json({ detail: '排班不存在或未开放' });
  }
  
  // 检查容量
  if (schedule.booked_count >= schedule.capacity) {
    return res.status(400).json({ detail: '排班容量不足' });
  }
  
  // 检查是否已预约
  const existingAppointment = appointments.find(
    a => a.patient_id === patient_id && a.schedule_id === schedule_id && a.status !== 'cancelled'
  );
  if (existingAppointment) {
    return res.json(existingAppointment);
  }
  
  // 创建预约并更新排班计数
  const newAppointment = {
    id: nextAppointmentId++,
    patient_id,
    doctor_id,
    schedule_id,
    status: 'confirmed'
  };
  
  appointments.push(newAppointment);
  schedule.booked_count++;
  
  res.json(newAppointment);
});

// 获取我的预约
app.get('/appointments/my', (req, res) => {
  const patientId = parseInt(req.query.patient_id);
  const result = appointments.filter(a => a.patient_id === patientId);
  res.json(result);
});

// 取消预约
app.post('/appointments/:id/cancel', (req, res) => {
  const appointmentId = parseInt(req.params.id);
  const patientId = parseInt(req.query.patient_id);
  
  const appointment = appointments.find(a => a.id === appointmentId && a.patient_id === patientId);
  if (!appointment) {
    return res.status(404).json({ detail: '预约不存在或无权限' });
  }
  
  if (appointment.status === 'cancelled') {
    return res.json({ message: '已取消' });
  }
  
  appointment.status = 'cancelled';
  
  const schedule = doctorSchedules.find(ds => ds.id === appointment.schedule_id);
  if (schedule && schedule.booked_count > 0) {
    schedule.booked_count--;
  }
  
  res.json({ message: '已取消' });
});

// 医生获取自己的排班
app.get('/doctor/schedules/my', (req, res) => {
  const doctorId = parseInt(req.query.doctor_id);
  const result = doctorSchedules.filter(ds => ds.doctor_id === doctorId);
  res.json(result);
});

// 医生创建排班
app.post('/doctor/schedules', (req, res) => {
  const { doctor_id, date, start_time, end_time, capacity } = req.body;
  
  const doctor = users.find(u => u.id === doctor_id && u.role === 'doctor' && u.status === 'active');
  if (!doctor) {
    return res.status(400).json({ detail: '医生不存在或未激活' });
  }
  
  const newSchedule = {
    id: nextScheduleId++,
    doctor_id,
    date,
    start_time,
    end_time,
    capacity,
    booked_count: 0,
    status: 'open'
  };
  
  doctorSchedules.push(newSchedule);
  
  res.json(newSchedule);
});

// 医生删除排班
app.delete('/doctor/schedules/:id', (req, res) => {
  const scheduleId = parseInt(req.params.id);
  const doctorId = parseInt(req.query.doctor_id);
  
  const scheduleIndex = doctorSchedules.findIndex(ds => ds.id === scheduleId && ds.doctor_id === doctorId);
  if (scheduleIndex === -1) {
    return res.status(404).json({ detail: '排班不存在或无权限' });
  }
  
  const schedule = doctorSchedules[scheduleIndex];
  
  // 检查是否已有预约
  const hasAppointment = appointments.some(a => a.schedule_id === scheduleId && a.status !== 'cancelled');
  if (hasAppointment) {
    return res.status(400).json({ detail: '该排班已有预约，不可删除' });
  }
  
  doctorSchedules.splice(scheduleIndex, 1);
  
  res.json({ message: '已删除' });
});

// 医生获取自己的预约
app.get('/doctor/appointments/my', (req, res) => {
  const doctorId = parseInt(req.query.doctor_id);
  const result = appointments.filter(a => a.doctor_id === doctorId);
  res.json(result);
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