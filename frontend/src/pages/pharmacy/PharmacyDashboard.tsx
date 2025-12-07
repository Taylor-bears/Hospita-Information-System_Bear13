import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, message, DatePicker } from 'antd'
import { MedicineBoxOutlined, 
  FileTextOutlined, 
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  EditOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import { supabase } from '../../utils/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
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
  id: string
  patient_name: string
  patient_phone: string
  medicines: any[]
  total_amount: number
  status: 'pending' | 'dispensed' | 'cancelled'
  created_at: string
  doctor_name: string
}

interface Medicine {
  id: string
  name: string
  specification: string
  unit: string
  price: number
  stock: number
  min_stock: number
  status: 'active' | 'inactive'
}

interface ChartData {
  date: string
  prescriptions: number
  revenue: number
}

const PharmacyDashboard: React.FC = () => {
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
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<any>([dayjs().subtract(7, 'day'), dayjs()])

  const fetchPharmacyStats = async () => {
    try {
      // 获取药品统计
      const { count: totalMedicines } = await supabase
        .from('medicines')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      const { data: lowStockData } = await supabase
        .from('medicines')
        .select('*')
        .eq('status', 'active')
        .lte('stock', 10)

      // 获取处方统计
      const { count: pendingPrescriptions } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: completedPrescriptions } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dispensed')

      // 获取收入统计
      const today = dayjs().format('YYYY-MM-DD')
      const { data: todayRevenueData } = await supabase
        .from('prescriptions')
        .select('total_amount')
        .eq('status', 'dispensed')
        .gte('created_at', today)

      const { data: totalRevenueData } = await supabase
        .from('prescriptions')
        .select('total_amount')
        .eq('status', 'dispensed')

      const todayRevenue = todayRevenueData?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0
      const totalRevenue = totalRevenueData?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0

      setStats({
        totalMedicines: totalMedicines || 0,
        lowStockMedicines: lowStockData?.length || 0,
        pendingPrescriptions: pendingPrescriptions || 0,
        completedPrescriptions: completedPrescriptions || 0,
        totalRevenue,
        todayRevenue
      })

      setLowStockMedicines(lowStockData || [])
    } catch (error) {
      console.error('获取药房统计失败:', error)
      message.error('获取药房统计失败')
    }
  }

  const fetchRecentPrescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients!prescriptions_patient_id_fkey (
            name,
            phone
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('获取最近处方失败:', error)
        return
      }

      const formattedPrescriptions = data.map(item => ({
        id: item.id,
        patient_name: item.patients?.name || '未知患者',
        patient_phone: item.patients?.phone || '',
        medicines: item.medicines || [],
        total_amount: item.total_amount,
        status: item.status,
        created_at: item.created_at,
        doctor_name: item.doctor_name
      }))

      setRecentPrescriptions(formattedPrescriptions)
    } catch (error) {
      console.error('获取最近处方失败:', error)
    }
  }

  const fetchChartData = async () => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD')
      const endDate = dateRange[1].format('YYYY-MM-DD')

      // 获取每日处方和收入数据
      const { data: prescriptions } = await supabase
        .from('prescriptions')
        .select('created_at, total_amount, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      // 生成日期范围
      const dateMap = new Map()
      let currentDate = dayjs(startDate)
      while (currentDate.isBefore(dayjs(endDate).add(1, 'day'))) {
        const dateStr = currentDate.format('MM-DD')
        dateMap.set(dateStr, { date: dateStr, prescriptions: 0, revenue: 0 })
        currentDate = currentDate.add(1, 'day')
      }

      // 统计处方数据
      prescriptions?.forEach(pres => {
        const date = dayjs(pres.created_at).format('MM-DD')
        if (dateMap.has(date)) {
          dateMap.get(date).prescriptions++
          if (pres.status === 'dispensed') {
            dateMap.get(date).revenue += pres.total_amount || 0
          }
        }
      })

      setChartData(Array.from(dateMap.values()))
    } catch (error) {
      console.error('获取图表数据失败:', error)
    }
  }

  const handleDispensePrescription = async (prescriptionId: string) => {
    try {
      // 获取处方详情
      const { data: prescription, error: fetchError } = await supabase
        .from('prescriptions')
        .select('medicines')
        .eq('id', prescriptionId)
        .single()

      if (fetchError) {
        console.error('获取处方详情失败:', fetchError)
        message.error('获取处方详情失败')
        return
      }

      // 检查药品库存
      for (const medicine of prescription.medicines) {
        const { data: medData, error: medError } = await supabase
          .from('medicines')
          .select('stock')
          .eq('id', medicine.id)
          .single()

        if (medError || !medData || medData.stock < medicine.quantity) {
          message.error(`药品 ${medicine.name} 库存不足`)
          return
        }
      }

      // 更新处方状态
      const { error: updateError } = await supabase
        .from('prescriptions')
        .update({ status: 'dispensed' })
        .eq('id', prescriptionId)

      if (updateError) {
        console.error('更新处方状态失败:', updateError)
        message.error('更新处方状态失败')
        return
      }

      // 更新药品库存
      for (const medicine of prescription.medicines) {
        const { data: medData } = await supabase
          .from('medicines')
          .select('stock')
          .eq('id', medicine.id)
          .single()
        const newStock = (medData?.stock || 0) - (medicine.quantity || 0)
        await supabase
          .from('medicines')
          .update({ stock: newStock })
          .eq('id', medicine.id)
      }

      message.success('处方已配药完成')
      fetchRecentPrescriptions()
      fetchPharmacyStats()
    } catch (error) {
      console.error('配药失败:', error)
      message.error('配药失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'dispensed':
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
        return '待配药'
      case 'dispensed':
        return '已配药'
      case 'cancelled':
        return '已取消'
      default:
        return status
    }
  }

  useEffect(() => {
    fetchPharmacyStats()
    fetchRecentPrescriptions()
  }, [])

  useEffect(() => {
    fetchChartData()
  }, [dateRange])

  const prescriptionColumns = [
    {
      title: '患者信息',
      key: 'patient',
      render: (record: Prescription) => (
        <div>
          <div className="font-medium">{record.patient_name}</div>
          <div className="text-gray-500 text-sm">{record.patient_phone}</div>
        </div>
      )
    },
    {
      title: '药品数量',
      key: 'medicine_count',
      render: (record: Prescription) => (
        <span>{record.medicines.length} 种</span>
      )
    },
    {
      title: '总金额',
      key: 'total_amount',
      render: (record: Prescription) => (
        <span className="font-medium text-red-600">¥{record.total_amount.toFixed(2)}</span>
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => (
        <span>{dayjs(text).format('MM月DD日 HH:mm')}</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Prescription) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<MedicineBoxOutlined />}
              onClick={() => handleDispensePrescription(record.id)}
            >
              配药
            </Button>
          )}
        </Space>
      )
    }
  ]

  const medicineColumns = [
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-medium">{text}</span>
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification'
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit'
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number, record: Medicine) => (
        <span className={stock <= record.min_stock ? 'text-red-600 font-medium' : ''}>
          {stock}
        </span>
      )
    },
    {
      title: '最低库存',
      dataIndex: 'min_stock',
      key: 'min_stock'
    }
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">药房管理控制台</h1>
        <p className="text-gray-600">药房业务概览和管理</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="药品总数"
              value={stats.totalMedicines}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="库存不足药品"
              value={stats.lowStockMedicines}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待配药处方"
              value={stats.pendingPrescriptions}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="mb-6">
        <Col span={8}>
          <Card>
            <Statistic
              title="今日收入"
              value={stats.todayRevenue}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix="¥"
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
        <Col span={8}>
          <Card>
            <Statistic
              title="已完成配药"
              value={stats.completedPrescriptions}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮区域 */}
      <Row gutter={16} className="mb-6">
        <Col span={24}>
          <Card>
            <Space>
              <Button 
                type="primary" 
                icon={<MedicineBoxOutlined />}
                onClick={() => window.location.href = '/pharmacy/inventory'}
              >
                库存管理
              </Button>
              <Button 
                type="primary" 
                icon={<EditOutlined />}
                onClick={() => window.location.href = '/pharmacy/prices'}
              >
                价格调整
              </Button>
              <Button 
                icon={<HistoryOutlined />}
                onClick={() => window.location.href = '/pharmacy/prices'}
              >
                价格历史
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
          <Card title="库存不足药品">
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
      <Card title="最近处方">
        <Table
          columns={prescriptionColumns}
          dataSource={recentPrescriptions}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  )
}

export default PharmacyDashboard
