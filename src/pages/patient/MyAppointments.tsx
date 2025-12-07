import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Form, DatePicker, Select, message, Row, Col } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const MyAppointments: React.FC = () => {
  const { user } = useAuthStore()
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  const [appointments, setAppointments] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])

  const refetch = async () => {
    if (!user?.id) return
    try {
      const res = await api.get('/appointments/my', { params: { patient_id: user.id } })
      setAppointments(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      message.error('获取预约列表失败')
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const docRes = await api.get('/api/doctor/')
        setDoctors(Array.isArray(docRes.data) ? docRes.data : [])
      } catch {}
      await refetch()
    }
    init()
  }, [user?.id])

  // 取消预约
  const handleCancelAppointment = async (id: string) => {
    try {
      await api.post(`/appointments/${id}/cancel`, null, { params: { patient_id: user?.id } })
      message.success('预约已取消')
      refetch()
    } catch (error) {
      message.error('取消预约失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange'
      case 'scheduled': return 'blue'
      case 'confirmed': return 'blue'
      case 'completed': return 'green'
      case 'cancelled': return 'red'
      case 'no_show': return 'default'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待确认'
      case 'scheduled': return '已预约'
      case 'confirmed': return '已确认'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      case 'no_show': return '爽约'
      default: return status
    }
  }

  const getAppointmentStatus = (date: string, time: string, status: string) => {
    if (status !== 'confirmed') return status
    
    const appointmentDateTime = new Date(`${date}T${time}`)
    const now = new Date()
    
    if (appointmentDateTime < now) return 'expired'
    return status
  }

  const columns = [
    {
      title: '预约编号',
      dataIndex: 'appointment_number',
      key: 'appointment_number',
      width: 120,
    },
    {
      title: '医生信息',
      key: 'doctor',
      render: (record: any) => (
        <div>
          <div>{(doctors.find(d => Number(d.id) === Number(record.doctor_id))?.name) || '未知医生'}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {(doctors.find(d => Number(d.id) === Number(record.doctor_id))?.department) || '未知科室'}
          </div>
        </div>
      ),
    },
    {
      title: '预约时间',
      key: 'appointment_time',
      render: (record: any) => (
        <div>
          <div>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {record.appointment_date}
          </div>
          <div>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {record.appointment_time}
          </div>
        </div>
      ),
      width: 150,
    },
    {
      title: '预约类型',
      dataIndex: 'appointment_type',
      key: 'appointment_type',
      render: (type: string) => (
        <Tag color={type === 'online' ? 'blue' : 'green'}>
          {type === 'online' ? '在线' : '现场'}
        </Tag>
      ),
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => {
        const actualStatus = getAppointmentStatus(record.appointment_date, record.appointment_time, status)
        const displayStatus = actualStatus === 'expired' ? '已过期' : getStatusText(status)
        const color = actualStatus === 'expired' ? 'red' : getStatusColor(status)
        
        return (
          <Tag color={color}>
            {displayStatus}
          </Tag>
        )
      },
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (record: any) => {
        const actualStatus = getAppointmentStatus(record.appointment_date, record.appointment_time, record.status)
        const canCancel = record.status === 'pending' || record.status === 'confirmed'
        const isExpired = actualStatus === 'expired'
        
        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedAppointment(record)
                setDetailModalVisible(true)
              }}
            >
              查看
            </Button>
            {canCancel && !isExpired && (
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认取消预约',
                    content: '确定要取消这个预约吗？',
                    onOk: () => handleCancelAppointment(record.id)
                  })
                }}
              >
                取消
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>我的预约</h2>
        <Button onClick={() => refetch()}>刷新</Button>
      </div>
      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <span>时间范围：</span>
            <RangePicker
              style={{ width: 240 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col>
            <span>预约状态：</span>
            <Select
              style={{ width: 120 }}
              allowClear
              placeholder="全部状态"
            >
              <Select.Option value="pending">待确认</Select.Option>
              <Select.Option value="confirmed">已确认</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </Col>
          <Col>
            <Button type="primary">搜索</Button>
          </Col>
        </Row>
      </Card>

      {/* 预约列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={appointments}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{ emptyText: '暂无预约记录' }}
        />
      </Card>

      {/* 预约详情模态框 */}
      <Modal
        title="预约详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedAppointment && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>预约编号：</strong> {selectedAppointment.appointment_number}</div>
                </Col>
                <Col span={12}>
                  <div><strong>预约类型：</strong> 
                    <Tag color={selectedAppointment.appointment_type === 'online' ? 'blue' : 'green'}>
                      {selectedAppointment.appointment_type === 'online' ? '在线预约' : '现场预约'}
                    </Tag>
                  </div>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <div><strong>预约日期：</strong> {selectedAppointment.appointment_date}</div>
                </Col>
                <Col span={12}>
                  <div><strong>预约时间：</strong> {selectedAppointment.appointment_time}</div>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <div><strong>状态：</strong> 
                    <Tag color={getStatusColor(selectedAppointment.status)}>
                      {getStatusText(selectedAppointment.status)}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <div><strong>创建时间：</strong> {dayjs(selectedAppointment.created_at).format('YYYY-MM-DD HH:mm')}</div>
                </Col>
              </Row>
            </Card>

            <Card title="医生信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>医生姓名：</strong> {selectedAppointment.doctor?.name}</div>
                </Col>
                <Col span={12}>
                  <div><strong>专业：</strong> {selectedAppointment.doctor?.specialty}</div>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={24}>
                  <div><strong>所属医院：</strong> {selectedAppointment.doctor?.hospital}</div>
                </Col>
              </Row>
            </Card>

            {selectedAppointment.notes && (
              <Card title="备注信息">
                <div>{selectedAppointment.notes}</div>
              </Card>
            )}

            {selectedAppointment.status === 'completed' && selectedAppointment.feedback && (
              <Card title="就诊反馈" style={{ marginTop: 16 }}>
                <div>{selectedAppointment.feedback}</div>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default MyAppointments
