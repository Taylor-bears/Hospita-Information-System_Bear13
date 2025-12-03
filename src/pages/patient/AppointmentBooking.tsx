import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Form, 
  Select, 
  DatePicker, 
  Button, 
  Table, 
  Tag, 
  Space, 
  message,
  Modal,
  Input,
  Descriptions,
  Avatar,
  Row,
  Col,
  Statistic
} from 'antd'
import { 
  CalendarOutlined, 
  UserOutlined, 
  PhoneOutlined,
  MedicineBoxOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { Option } = Select
const { TextArea } = Input

interface Doctor {
  id: number
  name?: string
  department?: string
  title?: string
  license_number?: string
  hospital?: string
  is_approved?: boolean
  user_id: number
}

interface Schedule {
  id: number
  doctor_id: number
  date: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
}

interface Appointment {
  id: string
  doctor_id: string
  patient_id: string
  appointment_time: string
  status: string
  notes: string
}

export default function AppointmentBooking() {
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null)
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([])
  const [myAppointments, setMyAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)

  // 获取医生列表
  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/doctor/')
      const list: Doctor[] = Array.isArray(res.data) ? res.data : []
      setDoctors(list)
    } catch (error) {
      message.error('获取医生列表失败')
      console.error('Error fetching doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取排班信息
  const fetchSchedules = async (doctorId: number, date: dayjs.Dayjs) => {
    try {
      const dateStr = date.format('YYYY-MM-DD')
      const res = await api.get(`/appointments/doctor/${doctorId}/schedules`, { params: { date: dateStr } })
      const data: Schedule[] = Array.isArray(res.data) ? res.data : []
      setSchedules(data)
      generateTimeSlots(data)
    } catch (error) {
      message.error('获取排班信息失败')
      console.error('Error fetching schedules:', error)
    }
  }

  // 获取我的预约
  const fetchMyAppointments = async () => {
    try {
      const res = await api.get('/appointments/my', { params: { patient_id: user?.id } })
      setMyAppointments(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      message.error('获取预约记录失败')
      console.error('Error fetching appointments:', error)
    }
  }

  // 生成可用时间段
  const generateTimeSlots = (schedules: Schedule[]) => {
    const slots: string[] = []
    schedules.forEach(s => {
      if (s.booked_count < s.capacity) {
        slots.push(`${s.id}|${s.start_time}-${s.end_time}`)
      }
    })
    setAvailableTimeSlots(slots)
  }

  // 处理医生选择
  const handleDoctorChange = (doctorId: number) => {
    const doctor = doctors.find(d => d.id === doctorId)
    setSelectedDoctor(doctor || null)
    setSelectedDate(null)
    setAvailableTimeSlots([])
    form.setFieldsValue({ appointmentDate: null, appointmentTime: null })
  }

  // 处理日期选择
  const handleDateChange = (date: dayjs.Dayjs | null) => {
    setSelectedDate(date)
    setAvailableTimeSlots([])
    form.setFieldsValue({ appointmentTime: null })
    
    if (date && selectedDoctor) {
      fetchSchedules(selectedDoctor.id, date)
    }
  }

  // 提交预约
  const handleSubmit = async (values: any) => {
    try {
      setSubmitLoading(true)
      const [scheduleIdStr] = String(values.appointmentTime).split('|')
      const scheduleId = Number(scheduleIdStr)
      await api.post('/appointments', {
        patient_id: Number(user?.id),
        doctor_id: selectedDoctor?.id,
        schedule_id: scheduleId
      })
      message.success('预约成功！')
      form.resetFields()
      setSelectedDoctor(null)
      setSelectedDate(null)
      setAvailableTimeSlots([])
      fetchMyAppointments()
      
    } catch (error) {
      message.error('预约失败')
      console.error('Error creating appointment:', error)
    } finally {
      setSubmitLoading(false)
    }
  }

  // 取消预约
  const handleCancelAppointment = async (appointmentId: string) => {
    Modal.confirm({
      title: '确认取消预约',
      content: '确定要取消这个预约吗？',
      onOk: async () => {
        try {
          await api.post(`/appointments/${appointmentId}/cancel`, null, { params: { patient_id: user?.id } })
          message.success('预约已取消')
          fetchMyAppointments()
        } catch (error) {
          message.error('取消预约失败')
        }
      }
    })
  }

  useEffect(() => {
    fetchDoctors()
    fetchMyAppointments()
  }, [])

  const doctorColumns = [
    {
      title: '医生信息',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Doctor) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 'bold' }}>{record.name}</div>
            <div style={{ color: '#666', fontSize: '12px' }}>
              {record.department} · {record.title}
            </div>
          </div>
        </Space>
      )
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      render: (department: string) => (
        <Tag color="blue">{department}</Tag>
      )
    },
    {
      title: '职称',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: '医院',
      dataIndex: 'hospital',
      key: 'hospital',
      render: (hospital: string | undefined) => hospital || '未知医院'
    }
  ]

  const appointmentColumns = [
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '医生',
      dataIndex: 'doctor_id',
      key: 'doctor_name',
      render: (_: any, record: any) => {
        const d = doctors.find(doc => Number(doc.id) === Number(record.doctor_id))
        return d?.name || '未知医生'
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          scheduled: 'blue',
          completed: 'green',
          cancelled: 'red'
        }
        const texts = {
          scheduled: '已预约',
          completed: '已完成',
          cancelled: '已取消'
        }
        return <Tag color={colors[status as keyof typeof colors]}>{texts[status as keyof typeof texts]}</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'scheduled' && (
            <Button 
              type="link" 
              danger
              onClick={() => handleCancelAppointment(record.id)}
            >
              取消
            </Button>
          )}
        </Space>
      )
    }
  ]

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && current < dayjs().startOf('day')
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[24, 24]}>
        {/* 左侧预约表单 */}
        <Col xs={24} lg={12}>
          <Card title="预约医生" style={{ height: '100%' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ role: 'patient' }}
            >
              <Form.Item
                label="选择医生"
                name="doctorId"
                rules={[{ required: true, message: '请选择医生' }]}
              >
                <Select
                  placeholder="请选择医生"
                  onChange={handleDoctorChange}
                  loading={loading}
                >
                  {doctors.map(doctor => (
                  <Option key={doctor.id} value={doctor.id}>
                    <Space>
                      <span>{doctor.name || '未命名医生'}</span>
                      <span style={{ color: '#666' }}>
                          ({doctor.department || '未知科室'} · {doctor.title || '未知职称'})
                      </span>
                    </Space>
                  </Option>
                ))}
              </Select>
              </Form.Item>

              {selectedDoctor && (
                <Card size="small" style={{ marginBottom: '16px', backgroundColor: '#f0f7ff' }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="姓名">{selectedDoctor.name}</Descriptions.Item>
                    <Descriptions.Item label="科室">
                      <Tag color="blue">{selectedDoctor.department}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="职称">{selectedDoctor.title}</Descriptions.Item>
                    <Descriptions.Item label="执业证">{selectedDoctor.license_number}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Form.Item
                label="预约日期"
                name="appointmentDate"
                rules={[{ required: true, message: '请选择预约日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="请选择预约日期"
                  disabledDate={disabledDate}
                  onChange={handleDateChange}
                  format="YYYY年MM月DD日"
                />
              </Form.Item>

              <Form.Item
                label="预约时间"
                name="appointmentTime"
                rules={[{ required: true, message: '请选择预约时间' }]}
              >
                <Select
                  placeholder="请选择预约时段"
                  disabled={availableTimeSlots.length === 0}
                >
                  {availableTimeSlots.map(item => {
                    const [sid, label] = item.split('|')
                    return (
                      <Option key={item} value={item}>
                        {label}
                      </Option>
                    )
                  })}
                </Select>
              </Form.Item>

              <Form.Item
                label="备注"
                name="notes"
              >
                <TextArea 
                  rows={3} 
                  placeholder="请输入病情描述或其他备注信息（可选）"
                />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={submitLoading}
                  block
                  size="large"
                  icon={<CalendarOutlined />}
                >
                  提交预约
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右侧医生列表 */}
        <Col xs={24} lg={12}>
          <Card title="医生列表" style={{ height: '100%' }}>
            <Table
              columns={doctorColumns}
              dataSource={doctors}
              loading={loading}
              rowKey="id"
              pagination={false}
              size="small"
              onRow={(record) => ({
                onClick: () => {
                  form.setFieldsValue({ doctorId: record.id })
                  handleDoctorChange(record.id)
                },
                style: { cursor: 'pointer' }
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* 我的预约记录 */}
      <Row style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title="我的预约记录">
            <Table
              columns={appointmentColumns}
              dataSource={myAppointments}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
