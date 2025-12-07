import React, { useState, useEffect } from 'react'
import ErrorBoundary from '../../components/ErrorBoundary'
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, message, DatePicker } from 'antd'
import { 
  UserOutlined, 
  UserAddOutlined, 
  MedicineBoxOutlined, 
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import api from '../../lib/api'
import { isDemo, getAdminStats, getAdminUsers, getRoleDistribution } from '../../lib/demo'
import { roleName, statusColor, statusText } from '../../utils/admin'
// 图表库已移除，使用简易渲染代替
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { RangePicker } = DatePicker

interface SystemStats {
  totalUsers: number
  pendingApprovals: number
  totalAppointments: number
  pendingAppointments: number
  totalPrescriptions: number
  totalRevenue: number
}

interface RecentUser {
  id: string
  name: string
  phone: string
  role: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface ChartData {
  date: string
  appointments: number
  prescriptions: number
  revenue: number
}

interface RoleDistribution {
  role: string
  count: number
  percentage: number
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    pendingApprovals: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    totalPrescriptions: 0,
    totalRevenue: 0
  })
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [roleDistribution, setRoleDistribution] = useState<RoleDistribution[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<any>([dayjs().subtract(7, 'day'), dayjs()])

  const fetchSystemStats = async () => {
    try {
      const res = await api.get('/api/admin/stats')
      const s = res.data || {}
      setStats({
        totalUsers: Number(s.total_users || 0),
        pendingApprovals: Number(s.pending_doctors || 0),
        totalAppointments: Number(s.total_appointments || 0),
        pendingAppointments: Number(s.active_appointments || 0),
        totalPrescriptions: Number(s.total_prescriptions || 0),
        totalRevenue: Number(s.total_revenue || 0),
      })
    } catch (error) {
      if (isDemo) {
        setStats(getAdminStats())
      } else {
        setStats({ totalUsers: 0, pendingApprovals: 0, totalAppointments: 0, pendingAppointments: 0, totalPrescriptions: 0, totalRevenue: 0 })
      }
    }
  }

  const fetchRecentUsers = async () => {
    try {
      const res = await api.get('/api/admin/users')
      const users = Array.isArray(res.data) ? res.data : []
      const mapped: RecentUser[] = users.slice(0, 10).map((u: any) => ({
        id: String(u.id),
        name: u.name || '未命名',
        phone: u.phone,
        role: u.role || 'patient',
        status: (u.status === 'active') ? 'approved' : 'pending',
        created_at: u.created_at
      }))
      setRecentUsers(mapped)
    } catch (error) {
      setRecentUsers(isDemo ? getAdminUsers().slice(0, 10) as any : [])
    }
  }

  const fetchChartData = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD')
      const endDate = dateRange[1].format('YYYY-MM-DD')
      const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
      const perDay = days > 0 ? Math.floor(stats.totalAppointments / days) : 0
      const chart: ChartData[] = []
      let currentDate = dayjs(startDate)
      for (let i = 0; i < days; i++) {
        chart.push({
          date: currentDate.format('MM-DD'),
          appointments: perDay,
          prescriptions: 0,
          revenue: 0,
        })
        currentDate = currentDate.add(1, 'day')
      }
      setChartData(chart)
    } catch (error) {
      console.error('获取图表数据失败:', error)
    }
  }

  const fetchRoleDistribution = async () => {
    try {
      const usersRes = await api.get('/api/admin/users')
      const statsRes = await api.get('/api/admin/stats')
      const userCount = Array.isArray(usersRes.data) ? usersRes.data.filter((u: any) => u.role === 'patient').length : 0
      const docCount = Number(statsRes.data?.total_doctors || 0)
      const pharmacistCount = Number(statsRes.data?.total_pharmacists || 0)
      const adminCount = Number(statsRes.data?.total_admins || 1)
      const total = userCount + docCount + pharmacistCount + adminCount
      const distribution: RoleDistribution[] = [
        { role: '患者', count: userCount, percentage: total ? Math.round((userCount / total) * 100) : 0 },
        { role: '医生', count: docCount, percentage: total ? Math.round((docCount / total) * 100) : 0 },
        { role: '药房工作人员', count: pharmacistCount, percentage: total ? Math.round((pharmacistCount / total) * 100) : 0 },
        { role: '管理员', count: adminCount, percentage: total ? Math.round((adminCount / total) * 100) : 0 },
      ]
      setRoleDistribution(distribution)
    } catch (error) {
      setRoleDistribution(isDemo ? getRoleDistribution(getAdminUsers() as any) as any : [])
    }
  }


  useEffect(() => {
    fetchSystemStats()
    fetchRecentUsers()
    fetchRoleDistribution()
  }, [])

  useEffect(() => {
    fetchChartData()
  }, [dateRange])

  const userColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-medium">{text}</span>
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <span>{roleName(role)}</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor(status)}>{statusText(status)}</Tag>
      )
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => (
        <span>{dayjs(text).format('MM月DD日 HH:mm')}</span>
      )
    }
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <ErrorBoundary>
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">管理员控制台</h1>
        <p className="text-gray-600">系统概览和管理功能</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待审核用户"
              value={stats.pendingApprovals}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待处理预约"
              value={stats.pendingAppointments}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="总预约数"
              value={stats.totalAppointments}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总处方数"
              value={stats.totalPrescriptions}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.totalRevenue}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} className="mb-6">
        <Col span={16}>
          <Card 
            title="业务趋势" 
            extra={
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: 240 }}
              />
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 8 }}>
              {chartData.map(d => (
                <React.Fragment key={d.date}>
                  <div style={{ color: '#666' }}>{d.date}</div>
                  <div>
                    <div style={{ height: 8, background: '#e6f4ff' }}>
                      <div style={{ width: `${Math.min(100, d.appointments * 10)}%`, height: 8, background: '#1890ff' }} />
                    </div>
                    <div style={{ height: 8, background: '#f6ffed', marginTop: 6 }}>
                      <div style={{ width: `${Math.min(100, d.prescriptions * 10)}%`, height: 8, background: '#52c41a' }} />
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="用户角色分布">
            <div style={{ display: 'grid', gap: 8 }}>
              {roleDistribution.map((r, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{r.role}</span>
                  <span style={{ color: '#999' }}>{r.percentage}%（{r.count}）</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近用户 */}
      <Card title="最近注册用户">
        <Table
          columns={userColumns}
          dataSource={recentUsers}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '当前无用户' }}
        />
      </Card>
    </div>
    </ErrorBoundary>
  )
}

export default AdminDashboard
