import React from 'react'
import { Card, Row, Col, Statistic, Button, Calendar, List, Tag, Space } from 'antd'
import { 
  CalendarOutlined, 
  RobotOutlined, 
  MedicineBoxOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const { Meta } = Card

export default function PatientDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // 模拟数据
  const upcomingAppointments = [
    {
      id: '1',
      doctor_name: '张医生',
      department: '内科',
      appointment_time: '2024-12-03 14:00',
      status: 'scheduled'
    },
    {
      id: '2', 
      doctor_name: '李医生',
      department: '外科',
      appointment_time: '2024-12-05 10:00',
      status: 'scheduled'
    }
  ]

  const recentPrescriptions = [
    {
      id: '1',
      doctor_name: '张医生',
      prescribed_date: '2024-12-01',
      status: 'paid',
      total_amount: 156.80
    },
    {
      id: '2',
      doctor_name: '王医生', 
      prescribed_date: '2024-11-28',
      status: 'dispensed',
      total_amount: 89.50
    }
  ]

  const quickActions = [
    {
      title: '预约医生',
      description: '在线预约各科室医生',
      icon: <CalendarOutlined style={{ fontSize: '32px', color: '#1890ff' }} />,
      action: () => navigate('/patient/appointment'),
      color: '#1890ff'
    },
    {
      title: 'AI问诊',
      description: '智能症状分析与建议',
      icon: <RobotOutlined style={{ fontSize: '32px', color: '#52c41a' }} />,
      action: () => navigate('/patient/ai-consult'),
      color: '#52c41a'
    },
    {
      title: '我的药单',
      description: '查看历史处方与购药',
      icon: <MedicineBoxOutlined style={{ fontSize: '32px', color: '#faad14' }} />,
      action: () => navigate('/patient/prescriptions'),
      color: '#faad14'
    },
    {
      title: '个人资料',
      description: '管理个人信息',
      icon: <UserOutlined style={{ fontSize: '32px', color: '#722ed1' }} />,
      action: () => navigate('/patient/profile'),
      color: '#722ed1'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'blue'
      case 'completed': return 'green'
      case 'paid': return 'orange'
      case 'dispensed': return 'green'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return '已预约'
      case 'completed': return '已完成'
      case 'paid': return '已支付'
      case 'dispensed': return '已发药'
      default: return status
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 欢迎区域 */}
      <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>
            欢迎回来，{user?.name}！
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.9 }}>
            今天是 {new Date().toLocaleDateString('zh-CN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              weekday: 'long'
            })}
          </p>
        </div>
      </Card>

      {/* 快捷操作 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {quickActions.map((action, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              hoverable
              onClick={action.action}
              style={{ 
                textAlign: 'center', 
                cursor: 'pointer',
                border: `2px solid ${action.color}20`,
                transition: 'all 0.3s ease'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <div style={{ marginBottom: '16px' }}>
                {action.icon}
              </div>
              <h3 style={{ 
                marginBottom: '8px', 
                color: action.color,
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                {action.title}
              </h3>
              <p style={{ color: '#666', fontSize: '14px' }}>
                {action.description}
              </p>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 统计信息和最近记录 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="预约统计" style={{ height: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="今日预约"
                  value={1}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="本月预约"
                  value={5}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="处方统计" style={{ height: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="待支付药单"
                  value={1}
                  prefix={<MedicineBoxOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="历史药单"
                  value={12}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="快速日历" style={{ height: '100%' }}>
            <Calendar 
              fullscreen={false}
              style={{ border: 'none' }}
              headerRender={() => null}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近预约 */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ClockCircleOutlined />
                <span>最近预约</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/patient/appointment')}>
                查看全部
              </Button>
            }
          >
            <List
              dataSource={upcomingAppointments}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.doctor_name}</span>
                        <Tag color="blue">{item.department}</Tag>
                      </Space>
                    }
                    description={
                      <Space>
                        <span>{item.appointment_time}</span>
                        <Tag color={getStatusColor(item.status)}>
                          {getStatusText(item.status)}
                        </Tag>
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
                <MedicineBoxOutlined />
                <span>最近药单</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/patient/prescriptions')}>
                查看全部
              </Button>
            }
          >
            <List
              dataSource={recentPrescriptions}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>处方 #{item.id}</span>
                        <span>医生：{item.doctor_name}</span>
                      </Space>
                    }
                    description={
                      <Space>
                        <span>{item.prescribed_date}</span>
                        <Tag color={getStatusColor(item.status)}>
                          {getStatusText(item.status)}
                        </Tag>
                        <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                          ¥{item.total_amount}
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