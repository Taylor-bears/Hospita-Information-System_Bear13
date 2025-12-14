import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Calendar,
  List,
  Tag,
  Space,
  Button,
  Avatar,
  Badge,
  Timeline,
  Empty
} from 'antd'
import {
  CalendarOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UsergroupAddOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export default function DoctorDashboard() {
  const { user } = useAuthStore()
  const [todayAppointments, setTodayAppointments] = useState<any[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([])
  const [recentPrescriptions, setRecentPrescriptions] = useState<any[]>([])
  const [statistics, setStatistics] = useState({
    todayAppointments: 0,
    weekAppointments: 0,
    pendingPrescriptions: 0,
    totalPatients: 0
  })
  const [loading, setLoading] = useState(true)

  // 获取今日预约
  const fetchTodayAppointments = async () => {
    try {
      const today = dayjs().format('YYYY-MM-DD')
      // date_to is exclusive in backend logic: q = q.filter(models.DoctorSchedule.date < dtt)
      // So to get today's appointments, we need date_from=today and date_to=tomorrow
      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
      const res = await api.get(`/appointments/doctor/${user?.id}`, {
        params: {
          date_from: today,
          date_to: tomorrow
        }
      })
      // Ensure res.data is an array
      setTodayAppointments(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      console.error('Error fetching today appointments:', error)
      setTodayAppointments([])
    }
  }

  // 获取近期预约
  const fetchUpcomingAppointments = async () => {
    try {
      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
      const nextWeek = dayjs().add(8, 'day').format('YYYY-MM-DD')
      const res = await api.get(`/appointments/doctor/${user?.id}`, {
        params: {
          date_from: tomorrow,
          date_to: nextWeek
        }
      })
      setUpcomingAppointments(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error)
      setUpcomingAppointments([])
    }
  }

  // 获取近期处方
  const fetchRecentPrescriptions = async () => {
    try {
      const res = await api.get('/api/doctor/prescriptions', { params: { doctor_id: user?.id } })
      setRecentPrescriptions(res.data.slice(0, 5) || [])
    } catch (error) {
      console.error('Error fetching recent prescriptions:', error)
      setRecentPrescriptions([])
    }
  }

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      const res = await api.get('/api/stats/doctor', { params: { doctor_id: user?.id } })
      setStatistics(res.data)
    } catch (error) {
      console.error('Error fetching statistics:', error)
    }
  }

  // 获取预约时间段
  const getAppointmentTime = (time: string) => {
    // time format is "HH:mm-HH:mm" or just "HH:mm"
    return time
  }

  // 获取预约状态标签
  const getAppointmentStatus = (status: string) => {
    const statusMap = {
      scheduled: { color: 'blue', text: '已预约' },
      completed: { color: 'green', text: '已完成' },
      cancelled: { color: 'red', text: '已取消' }
    }
    const statusInfo = statusMap[status as keyof typeof statusMap]
    return <Tag color={statusInfo?.color}>{statusInfo?.text}</Tag>
  }

  // 获取处方状态标签
  const getPrescriptionStatus = (status: string) => {
    const statusMap = {
      pending: { color: 'orange', text: '待支付' },
      paid: { color: 'blue', text: '已支付' },
      dispensed: { color: 'green', text: '已发药' }
    }
    const statusInfo = statusMap[status as keyof typeof statusMap]
    return <Tag color={statusInfo?.color}>{statusInfo?.text}</Tag>
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchTodayAppointments(),
        fetchUpcomingAppointments(),
        fetchRecentPrescriptions(),
        fetchStatistics()
      ])
      setLoading(false)
    }

    loadData()
  }, [user?.id])

  // 获取日历事件
  const getCalendarEvents = () => {
    const events = upcomingAppointments.map(appointment => ({
      date: appointment.appointment_date,
      content: (
        <div style={{ fontSize: '12px' }}>
          <Badge status="processing" text={`${getAppointmentTime(appointment.appointment_time)} ${appointment.patient_name}`} />
        </div>
      )
    }))
    return events
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="今日预约"
              value={statistics.todayAppointments}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="本周预约"
              value={statistics.weekAppointments}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="待处理处方"
              value={statistics.pendingPrescriptions}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总患者数"
              value={statistics.totalPatients}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* 今日预约 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>今日预约</span>
                <Badge count={todayAppointments.length} showZero />
              </Space>
            }
            style={{ height: '100%' }}
          >
            {todayAppointments.length > 0 ? (
              <Timeline>
                {todayAppointments.map(appointment => (
                  <Timeline.Item
                    key={appointment.id}
                    color="blue"
                    dot={<ClockCircleOutlined />}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <strong>{getAppointmentTime(appointment.appointment_time)}</strong>
                        <span style={{ marginLeft: '8px' }}>
                          {appointment.patient_name}
                        </span>
                      </div>
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        电话: {appointment.patient_phone}
                      </div>
                      {appointment.notes && (
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          备注: {appointment.notes}
                        </div>
                      )}
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Empty description="今日暂无预约" />
            )}
          </Card>
        </Col>

        {/* 预约日历 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>预约日历</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Calendar
              fullscreen={false}
              dateCellRender={(date) => {
                const events = getCalendarEvents().filter(
                  event => event.date === date.format('YYYY-MM-DD')
                )
                return (
                  <div>
                    {events.map((event, index) => (
                      <div key={index}>{event.content}</div>
                    ))}
                  </div>
                )
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 近期预约和处方 */}
      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>近期预约</span>
              </Space>
            }
          >
            <List
              dataSource={upcomingAppointments}
              renderItem={appointment => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={
                      <Space>
                        <span>{appointment.patient_name}</span>
                        {getAppointmentStatus(appointment.status)}
                      </Space>
                    }
                    description={
                      <Space direction="vertical">
                        <span>{appointment.appointment_date} {appointment.appointment_time}</span>
                        <span style={{ color: '#666' }}>电话: {appointment.patient_phone}</span>
                        {appointment.notes && (
                          <span style={{ color: '#666' }}>备注: {appointment.notes}</span>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>近期处方</span>
              </Space>
            }
          >
            <List
              dataSource={recentPrescriptions}
              renderItem={prescription => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<MedicineBoxOutlined />} />}
                    title={
                      <Space>
                        <span>处方 #{prescription.id}</span>
                        {getPrescriptionStatus(prescription.status)}
                      </Space>
                    }
                    description={
                      <Space direction="vertical">
                        <span>患者: {prescription.patient_name}</span>
                        <span style={{ color: '#666' }}>
                          开具时间: {dayjs(prescription.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                        <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                          金额: ¥{prescription.total_price}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}