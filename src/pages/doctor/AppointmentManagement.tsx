import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, Space, message, Card, Row, Col, Statistic } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined, CalendarOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { supabase } from '../../utils/supabase'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Option } = Select

interface Appointment {
  id: string
  patient_name: string
  patient_phone: string
  appointment_date: string
  appointment_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
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
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patients!appointments_patient_id_fkey (
            name,
            phone,
            age,
            gender
          )
        `)
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: true })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      if (dateRange) {
        query = query
          .gte('appointment_date', dateRange[0].format('YYYY-MM-DD'))
          .lte('appointment_date', dateRange[1].format('YYYY-MM-DD'))
      }

      const { data, error } = await query

      if (error) {
        console.error('获取预约失败:', error)
        message.error('获取预约失败')
        return
      }

      const formattedAppointments = data.map(item => ({
        id: item.id,
        patient_name: item.patients?.name || '未知患者',
        patient_phone: item.patients?.phone || '',
        appointment_date: item.appointment_date,
        appointment_time: item.appointment_time,
        status: item.status,
        notes: item.notes || '',
        symptoms: item.symptoms || '',
        created_at: item.created_at,
        doctor_name: item.doctor_name,
        department: item.department
      }))

      setAppointments(formattedAppointments)
    } catch (error) {
      console.error('获取预约失败:', error)
      message.error('获取预约失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [user, filterStatus, dateRange])

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)

      if (error) {
        console.error('更新预约状态失败:', error)
        message.error('更新预约状态失败')
        return
      }

      message.success('预约状态已更新')
      fetchAppointments()
    } catch (error) {
      console.error('更新预约状态失败:', error)
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

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          notes: values.notes,
          symptoms: values.symptoms
        })
        .eq('id', selectedAppointment.id)

      if (error) {
        console.error('更新备注失败:', error)
        message.error('更新备注失败')
        return
      }

      message.success('备注已更新')
      setModalVisible(false)
      fetchAppointments()
    } catch (error) {
      console.error('更新备注失败:', error)
      message.error('更新备注失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'confirmed':
        return 'blue'
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
      case 'pending':
        return '待确认'
      case 'confirmed':
        return '已确认'
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
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length
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
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleStatusUpdate(record.id, 'confirmed')}
            >
              确认
            </Button>
          )}
          {record.status === 'confirmed' && (
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
              title="待确认"
              value={statistics.pending}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已确认"
              value={statistics.confirmed}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statistics.completed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
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
              <Option value="pending">待确认</Option>
              <Option value="confirmed">已确认</Option>
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
              刷新数据
            </Button>
          </div>
        </div>
      </Card>

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
