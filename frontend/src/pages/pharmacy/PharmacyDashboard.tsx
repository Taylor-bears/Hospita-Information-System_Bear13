import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, message, DatePicker, Popconfirm } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  MedicineBoxOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  HistoryOutlined,
  ExperimentOutlined
} from '@ant-design/icons'
import api from '../../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { RangePicker } = DatePicker

interface PharmacyStats {
  totalMedicines: number
  lowStockMedicines: number
  pendingPrescriptions: number
  completedPrescriptions: number
  totalRevenue: number
  todayRevenue: number
}

interface Prescription {
  id: number
  patient_id: number
  doctor_id: number
  status: string
  total_price: number
  created_at: string
  items: any[]
  patient_name?: string // Optional, might not be populated yet
}

interface Medicine {
  id: number
  name: string
  specification: string
  unit: string
  price: number
  stock: number
  min_stock: number
  status: string
}

const PharmacyDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PharmacyStats>({
    totalMedicines: 0,
    lowStockMedicines: 0,
    pendingPrescriptions: 0,
    completedPrescriptions: 0,
    totalRevenue: 0,
    todayRevenue: 0
  })
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([])
  const [lowStockMedicines, setLowStockMedicines] = useState<Medicine[]>([])
  const [dateRange, setDateRange] = useState<any>([dayjs().subtract(7, 'days'), dayjs()])
  const [chartData, setChartData] = useState<any[]>([])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/stats/pharmacy')
      setStats(res.data)

      // Fetch recent prescriptions for the table
      const presRes = await api.get('/api/pharmacy/prescriptions')
      setRecentPrescriptions(presRes.data.slice(0, 5))

      // Fetch low stock medicines
      const medsRes = await api.get('/api/admin/medications')
      const meds: Medicine[] = medsRes.data
      setLowStockMedicines(meds.filter(m => m.stock <= m.min_stock))

      // Prepare Chart Data (Last 7 days) - Mock for now or implement backend aggregation
      const chart = []
      for (let i = 6; i >= 0; i--) {
        const date = dayjs().subtract(i, 'days').format('YYYY-MM-DD')
        chart.push({
          date,
          prescriptions: Math.floor(Math.random() * 10), // Mock
          revenue: Math.floor(Math.random() * 1000) // Mock
        })
      }
      setChartData(chart)

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const medicineColumns = [
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '当前库存',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number) => (
        <Tag color="red">{stock}</Tag>
      ),
    },
    {
      title: '补货阈值',
      dataIndex: 'min_stock',
      key: 'min_stock',
    },
  ]

  const handleQuickDispense = async (id: number) => {
    try {
      await api.post(`/api/pharmacy/prescriptions/${id}/dispense`)
      message.success('发药成功')
      fetchDashboardData() // Refresh data
    } catch (error) {
      message.error('发药失败')
    }
  }

  const prescriptionColumns = [
    {
      title: '处方号',
      dataIndex: 'id',
      key: 'id',
      render: (id: number) => `#${id}`
    },
    {
      title: '患者',
      key: 'patient',
      render: (text: any, record: Prescription) => record.patient_name || `Patient ${record.patient_id}`
    },
    {
      title: '金额',
      dataIndex: 'total_price',
      key: 'total_price',
      render: (price: number) => `¥${price.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'orange',
          paid: 'blue',
          completed: 'green',
          cancelled: 'red'
        }
        const labels: Record<string, string> = {
          pending: '待支付',
          paid: '待配药',
          completed: '已完成',
          cancelled: '已取消'
        }
        return <Tag color={colors[status] || 'default'}>{labels[status] || status}</Tag>
      }
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Prescription) => (
        record.status === 'paid' ? (
          <Popconfirm
            title="确认发药"
            onConfirm={() => handleQuickDispense(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button type="link" size="small">发药</Button>
          </Popconfirm>
        ) : null
      )
    }
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">药房管理工作台</h1>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="待配药处方"
              value={stats.pendingPrescriptions}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="库存预警"
              value={stats.lowStockMedicines}
              valueStyle={{ color: '#faad14' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日收入"
              value={stats.todayRevenue}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={6}>
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

      {/* 操作按钮区域 */}
      <Row gutter={16} className="mb-6">
        <Col span={24}>
          <Card>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                icon={<ExperimentOutlined />}
                onClick={() => navigate('/pharmacy/prescriptions')}
              >
                配药处理
              </Button>
              <Button
                size="large"
                icon={<MedicineBoxOutlined />}
                onClick={() => navigate('/pharmacy/inventory')}
              >
                库存管理
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} className="mb-6">
        <Col span={16}>
          <Card
            title="药房业务趋势"
            extra={
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: 240 }}
              />
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="prescriptions" fill="#1890ff" name="处方数" />
                <Bar dataKey="revenue" fill="#52c41a" name="收入" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="库存不足药品" extra={<a onClick={() => navigate('/pharmacy/inventory')}>查看全部</a>}>
            <Table
              columns={medicineColumns}
              dataSource={lowStockMedicines}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 240 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近处方 */}
      <Card title="最近处方" extra={<a onClick={() => navigate('/pharmacy/prescriptions')}>查看全部</a>}>
        <Table
          columns={prescriptionColumns}
          dataSource={recentPrescriptions}
          loading={loading}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default PharmacyDashboard
