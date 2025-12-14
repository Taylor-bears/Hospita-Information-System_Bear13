import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Input,
  Descriptions,
  Avatar,
  Row,
  Col,
  Statistic
} from 'antd'
import { Modal } from 'antd'
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
  fully_booked?: boolean
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
  const [searchParams] = useSearchParams()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  // 简化为“上/下午”选择
  const [myAppointments, setMyAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  // 最简版本去除改期功能，避免后端无对应接口导致失败

  // 获取医生列表
  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/doctor/')
      const list: Doctor[] = Array.isArray(res.data) ? res.data : []
      setDoctors(list)
    } catch (error) {
      message.error('获取医生列表失败')
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
    } catch (error) {
      message.error('获取排班信息失败')
    }
  }

  // 去除改期槽位生成

  // 获取我的预约
  const fetchMyAppointments = async () => {
    try {
      const res = await api.get('/appointments/my', { params: { patient_id: user?.id } })
      setMyAppointments(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      message.error('获取预约记录失败')
    }
  }

  // 计算上/下午标签
  const getPeriodLabel = (s: Schedule) => {
    const h = Number(String(s.start_time).split(':')[0])
    return h < 12 ? '上午' : '下午'
  }

  // 处理医生选择
  const handleDoctorChange = (doctorId: number) => {
    const doctor = doctors.find(d => d.id === doctorId)
    setSelectedDoctor(doctor || null)
    setSelectedDate(null)
    form.setFieldsValue({ appointmentDate: null, appointmentTime: null })
  }

  // 处理日期选择
  const handleDateChange = (date: dayjs.Dayjs | null) => {
    setSelectedDate(date)
    setSchedules([])
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
      await fetchMyAppointments()
      // 预约成功后刷新该日期的排班容量与已预约数，便于患者看到扣减效果
      if (selectedDoctor && selectedDate) {
        await fetchSchedules(selectedDoctor.id, selectedDate)
      }
    } catch (error) {
      message.error('预约失败')
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

  // 去除改期入口

  // 去除改期日期处理

  // 去除改期提交

  useEffect(() => {
    fetchDoctors()
    fetchMyAppointments()
  }, [])

  useEffect(() => {
    const dept = searchParams.get('department')
    if (dept) {
      setSelectedDepartment(dept)
    }
  }, [searchParams])

  const uniqueDepartments = Array.from(new Set(doctors.map(d => d.department).filter(Boolean))) as string[]
  const filteredDoctors = selectedDepartment
    ? doctors.filter(d => d.department === selectedDepartment)
    : doctors

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
        const colors: Record<string, string> = {
          scheduled: 'blue',
          confirmed: 'blue',
          completed: 'green',
          cancelled: 'red'
        }
        const texts: Record<string, string> = {
          scheduled: '已预约',
          confirmed: '已预约',
          completed: '已完成',
          cancelled: '已取消'
        }
        const c = colors[status] || 'blue'
        const t = texts[status] || status
        return <Tag color={c}>{t}</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'scheduled' || record.status === 'confirmed' ? (
            <Button
              type="link"
              danger
              onClick={() => handleCancelAppointment(record.id)}
            >
              取消
            </Button>
          ) : null}
        </Space>
      )
    }
  ]

  const disabledDate = (current: dayjs.Dayjs) => {
    const today = dayjs().startOf('day')
    const max = dayjs().add(7, 'day').endOf('day')
    return !!current && (current < today || current > max)
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
              <Form.Item label="筛选科室">
                <Select
                  placeholder="全部科室"
                  allowClear
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                >
                  {uniqueDepartments.map(dept => (
                    <Option key={dept} value={dept}>{dept}</Option>
                  ))}
                </Select>
              </Form.Item>

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
                  {filteredDoctors.map(doctor => (
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
                  placeholder="请选择上/下午"
                  disabled={!selectedDoctor || !selectedDate}
                  allowClear
                >
                  {schedules.map(s => {
                    const label = getPeriodLabel(s)
                    const full = s.fully_booked ?? (s.booked_count >= s.capacity)
                    const text = full ? `${label}（已预约满）` : label
                    const value = `${s.id}|${label}`
                    return (
                      <Option key={value} value={value} disabled={full}>
                        {text}
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
              dataSource={filteredDoctors}
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
