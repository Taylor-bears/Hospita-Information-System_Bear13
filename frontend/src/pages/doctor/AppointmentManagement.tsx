import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, Space, message, Card, Row, Col, Statistic, InputNumber } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined, CalendarOutlined, UserOutlined, ClockCircleOutlined, MedicineBoxOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Option } = Select

interface Appointment {
  id: string
  patient_id: number
  patient_name: string
  patient_phone: string
  appointment_date: string
  appointment_time: string
  status: 'scheduled' | 'confirmed' | 'pending' | 'completed' | 'cancelled'
  notes: string
  symptoms: string
  created_at: string
  doctor_name?: string
  department?: string
}

interface Patient {
  id: string
  name: string
  phone: string
  age: number
  gender: string
}

const AppointmentManagement: React.FC = () => {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState<any>(null)
  const [searchText, setSearchText] = useState('')

  const fetchAppointments = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await api.get(`/appointments/doctor/${user.id}`)
      let data: Appointment[] = Array.isArray(res.data) ? res.data : []
      data = data.map(a => {
        const normalizedStatus = (a.status === 'confirmed' || a.status === 'pending') ? 'scheduled' : a.status
        return { ...a, status: normalizedStatus }
      })
      if (filterStatus !== 'all') {
        data = data.filter(a => a.status === filterStatus)
      }
      if (dateRange) {
        const start = dateRange[0].format('YYYY-MM-DD')
        const end = dateRange[1].format('YYYY-MM-DD')
        data = data.filter(a => a.appointment_date >= start && a.appointment_date <= end)
      }
      setAppointments(data)
    } catch (error) {
      message.error('获取预约失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [user, filterStatus, dateRange])

  const handleStatusUpdate = async (appointmentId: string, newStatus: 'scheduled' | 'completed' | 'cancelled') => {
    try {
      await api.post(`/appointments/${appointmentId}/status`, { status: newStatus })
      message.success('预约状态已更新')
      fetchAppointments()
    } catch (error) {
      message.error('更新预约状态失败')
    }
  }

  const handleViewDetails = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setModalVisible(true)
    form.setFieldsValue({
      notes: appointment.notes,
      symptoms: appointment.symptoms
    })
  }

  const handleUpdateNotes = async (values: any) => {
    if (!selectedAppointment) return
    message.success('备注已保存')
    setModalVisible(false)
    fetchAppointments()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'confirmed':
        return 'blue'
      case 'pending':
        return 'orange'
      case 'completed':
        return 'green'
      case 'cancelled':
        return 'red'
      default:
        return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'confirmed':
        return '已预约'
      case 'pending':
        return '待确认'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
      default:
        return status
    }
  }

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = appointment.patient_name.toLowerCase().includes(searchText.toLowerCase()) ||
      appointment.patient_phone.includes(searchText)
    return matchesSearch
  })

  const statistics = {
    total: appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length
  }

  const disabledScheduleDate = (current: dayjs.Dayjs) => {
    const today = dayjs().startOf('day')
    const max = dayjs().add(7, 'day').endOf('day')
    return !!current && (current < today || current > max)
  }

  const columns = [
    {
      title: '患者信息',
      key: 'patient',
      render: (record: Appointment) => (
        <div>
          <div className="font-medium">{record.patient_name}</div>
          <div className="text-gray-500 text-sm">{record.patient_phone}</div>
        </div>
      )
    },
    {
      title: '预约时间',
      key: 'time',
      render: (record: Appointment) => (
        <div>
          <div className="font-medium">{dayjs(record.appointment_date).format('MM月DD日')}</div>
          <div className="text-gray-500 text-sm">{record.appointment_time}</div>
        </div>
      )
    },
    {
      title: '症状描述',
      dataIndex: 'symptoms',
      key: 'symptoms',
      width: 200,
      render: (text: string) => (
        <div className="max-w-xs truncate" title={text}>
          {text || '-'}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Appointment) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            查看详情
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<MedicineBoxOutlined />}
            onClick={() => {
              navigate('/doctor/prescriptions', {
                state: {
                  patientId: record.patient_id,
                  patientName: record.patient_name,
                  appointmentId: record.id
                }
              })
            }}
          >
            开方
          </Button>
          {record.status === 'scheduled' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleStatusUpdate(record.id, 'completed')}
            >
              完成
            </Button>
          )}
          {record.status !== 'completed' && record.status !== 'cancelled' && (
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleStatusUpdate(record.id, 'cancelled')}
            >
              取消
            </Button>
          )}
        </Space>
      )
    }
  ]

  // 简易排班设置：为选定日期创建上午/下午排班并设定容量
  const [scheduleForm] = Form.useForm()
  const [daySlots, setDaySlots] = useState<any[]>([])
  const refreshDaySlots = async (dateStr: string) => {
    if (!user?.id) return
    const res = await api.get(`/appointments/doctor/${user.id}/schedules`, { params: { date: dateStr } })
    const list: any[] = Array.isArray(res.data) ? res.data : []
    const mapped = list.map(s => ({
      period: Number(String(s.start_time).split(':')[0]) < 12 ? '上午排班' : '下午排班',
      capacity: s.capacity,
      booked: s.booked_count
    }))
    setDaySlots(mapped)
  }
  const createOrUpdateAmPm = async (values: any) => {
    try {
      if (!user?.id) return
      const dateStr = values.workDate.format('YYYY-MM-DD')
      // 获取医生已有排班
      const my = await api.get('/doctor/schedules/my', { params: { doctor_id: Number(user.id) } })
      const items: any[] = Array.isArray(my.data) ? my.data : []
      const target = (startHour: number) => items.find(s => s.date === dateStr && Number(String(s.start_time).split(':')[0]) === startHour)
      const create = async (start: string, end: string, cap: number) => {
        await api.post('/doctor/schedules', {
          doctor_id: Number(user.id),
          date: dateStr,
          start_time: start,
          end_time: end,
          capacity: cap
        })
      }
      // 上午 09:00-12:00（UPSERT，无需先删）
      const amCap = Number(values.amCapacity || 0)
      if (amCap > 0) await create('09:00:00', '12:00:00', amCap)
      // 下午 13:00-17:00（UPSERT，无需先删）
      const pmCap = Number(values.pmCapacity || 0)
      if (pmCap > 0) await create('13:00:00', '17:00:00', pmCap)
      message.success('排班已更新')
      await refreshDaySlots(dateStr)
    } catch (e) {
      message.error('更新排班失败')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">预约管理</h1>
        <p className="text-gray-600">管理您的患者预约</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总预约数"
              value={statistics.total}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已预约"
              value={statistics.scheduled}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statistics.completed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col span={6} />
      </Row>

      {/* 筛选器 */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium mb-1">状态筛选</label>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="scheduled">已预约</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">日期范围</label>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 240 }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">搜索患者</label>
            <Input
              placeholder="输入患者姓名或手机号"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          </div>
          <div className="mt-6">
            <Button type="primary" onClick={fetchAppointments}>
              刷新排班
            </Button>
          </div>
        </div>
      </Card>

      {/* 排班设置（上午/下午容量） */}
      <Card className="mb-6" title={
        <Space>
          <CalendarOutlined />
          <span>设置排班（上午/下午排班）</span>
        </Space>
      }>
        <Form form={scheduleForm} layout="inline" onFinish={createOrUpdateAmPm}>
          <Form.Item label="日期" name="workDate" rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker
              disabledDate={disabledScheduleDate}
              onChange={(d) => { if (d) refreshDaySlots(d.format('YYYY-MM-DD')) }}
            />
          </Form.Item>
          <Form.Item label="上午排班" name="amCapacity">
            <InputNumber min={0} max={200} placeholder="人数" />
          </Form.Item>
          <Form.Item label="下午排班" name="pmCapacity">
            <InputNumber min={0} max={200} placeholder="人数" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 当日容量概览 */}
      {daySlots.length > 0 && (
        <Card className="mb-6" title="当日排班概览">
          <Table
            dataSource={daySlots}
            rowKey={(r) => r.period}
            pagination={false}
            size="small"
            columns={[
              { title: '时间段', dataIndex: 'period', key: 'period' },
              { title: '容量', dataIndex: 'capacity', key: 'capacity' },
              { title: '已预约', dataIndex: 'booked', key: 'booked' },
            ]}
          />
        </Card>
      )}

      {/* 预约列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredAppointments}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="预约详情"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            保存备注
          </Button>
        ]}
        width={600}
      >
        {selectedAppointment && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleUpdateNotes}
          >
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">患者姓名</label>
                  <div className="font-medium">{selectedAppointment.patient_name}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">联系电话</label>
                  <div className="font-medium">{selectedAppointment.patient_phone}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">预约日期</label>
                  <div className="font-medium">{dayjs(selectedAppointment.appointment_date).format('YYYY年MM月DD日')}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">预约时间</label>
                  <div className="font-medium">{selectedAppointment.appointment_time}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">状态</label>
                  <div>
                    <Tag color={getStatusColor(selectedAppointment.status)}>
                      {getStatusText(selectedAppointment.status)}
                    </Tag>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">创建时间</label>
                  <div className="font-medium">{dayjs(selectedAppointment.created_at).format('MM月DD日 HH:mm')}</div>
                </div>
              </div>
            </div>

            <Form.Item
              label="症状描述"
              name="symptoms"
            >
              <TextArea
                rows={3}
                placeholder="请输入患者症状描述"
              />
            </Form.Item>

            <Form.Item
              label="医生备注"
              name="notes"
            >
              <TextArea
                rows={3}
                placeholder="请输入医生备注"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default AppointmentManagement
