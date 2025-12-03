import React, { useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Select, Table, Tag } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, MedicineBoxOutlined, ShoppingCartOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const ReportsAndAnalytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD')
  ])
  const [reportType, setReportType] = useState('sales')

  // 获取销售统计数据
  const { data: salesStats } = useQuery({
    queryKey: ['sales-stats', dateRange],
    queryFn: async () => {
      const [startDate, endDate] = dateRange
      
      // 获取销售总额
      const { data: salesData, error: salesError } = await supabase
        .from('orders')
        .select('total_amount, status, created_at')
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)
        .eq('status', 'completed')

      if (salesError) throw salesError

      // 获取处方统计
      const { data: prescriptionData, error: prescriptionError } = await supabase
        .from('prescriptions')
        .select('total_amount, status, created_at')
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)

      if (prescriptionError) throw prescriptionError

      const totalSales = salesData?.reduce((sum, item) => sum + item.total_amount, 0) || 0
      const totalPrescriptions = prescriptionData?.length || 0
      const prescriptionSales = prescriptionData?.reduce((sum, item) => sum + item.total_amount, 0) || 0

      // 计算环比数据（与上月对比）
      const lastMonthStart = dayjs(startDate).subtract(1, 'month').format('YYYY-MM-DD')
      const lastMonthEnd = dayjs(endDate).subtract(1, 'month').format('YYYY-MM-DD')

      const { data: lastMonthSales } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', lastMonthStart)
        .lte('created_at', `${lastMonthEnd}T23:59:59`)
        .eq('status', 'completed')

      const lastMonthTotal = lastMonthSales?.reduce((sum, item) => sum + item.total_amount, 0) || 0
      const salesGrowth = lastMonthTotal > 0 ? ((totalSales - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) : '0'

      return {
        totalSales,
        totalPrescriptions,
        prescriptionSales,
        salesGrowth,
        orderCount: salesData?.length || 0,
        avgOrderValue: salesData?.length > 0 ? totalSales / salesData.length : 0
      }
    },
    enabled: !!dateRange
  })

  // 获取药品销售排行
  const { data: drugRanking } = useQuery({
    queryKey: ['drug-ranking', dateRange],
    queryFn: async () => {
      const [startDate, endDate] = dateRange
      
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          drug_id,
          quantity,
          unit_price,
          drug:drugs(name, category, specification)
        `)
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)

      if (error) throw error

      // 按药品统计销售数据
      const drugStats = data?.reduce((acc, item) => {
        const drugId = item.drug_id
        if (!acc[drugId]) {
          acc[drugId] = {
            drugId,
            drugName: item.drug?.name,
            category: item.drug?.category,
            specification: item.drug?.specification,
            totalQuantity: 0,
            totalSales: 0
          }
        }
        acc[drugId].totalQuantity += item.quantity
        acc[drugId].totalSales += item.quantity * item.unit_price
        return acc
      }, {} as Record<string, any>)

      return Object.values(drugStats || {})
        .sort((a: any, b: any) => b.totalSales - a.totalSales)
        .slice(0, 10)
    },
    enabled: !!dateRange
  })

  // 获取库存预警数据
  const { data: inventoryAlerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          drug:drugs(name, drug_code, category, specification)
        `)
        .lt('current_stock', 'min_stock_level')
        .order('current_stock', { ascending: true })

      if (error) throw error
      return data || []
    }
  })

  // 获取客户统计
  const { data: customerStats } = useQuery({
    queryKey: ['customer-stats', dateRange],
    queryFn: async () => {
      const [startDate, endDate] = dateRange
      
      // 获取新增客户数
      const { data: newCustomers, error: customerError } = await supabase
        .from('users')
        .select('created_at')
        .eq('role', 'patient')
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)

      if (customerError) throw customerError

      // 获取活跃客户数（有订单的客户）
      const { data: activeCustomers, error: activeError } = await supabase
        .from('orders')
        .select('patient_id')
        .gte('created_at', startDate)
        .lte('created_at', `${endDate}T23:59:59`)
        .eq('status', 'completed')

      if (activeError) throw activeError

      const uniqueActiveCustomers = new Set(activeCustomers?.map(item => item.patient_id)).size

      return {
        newCustomers: newCustomers?.length || 0,
        activeCustomers: uniqueActiveCustomers,
        customerRetention: activeCustomers?.length > 0 ? (uniqueActiveCustomers / activeCustomers.length * 100).toFixed(1) : '0'
      }
    },
    enabled: !!dateRange
  })

  const drugRankingColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: '药品名称',
      dataIndex: 'drugName',
      key: 'drugName',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 150,
    },
    {
      title: '销售数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '销售金额',
      dataIndex: 'totalSales',
      key: 'totalSales',
      width: 120,
      align: 'right' as const,
      render: (amount: number) => `¥${amount?.toFixed(2)}`,
    },
  ]

  const inventoryColumns = [
    {
      title: '药品编码',
      dataIndex: ['drug', 'drug_code'],
      key: 'drug_code',
      width: 120,
    },
    {
      title: '药品名称',
      dataIndex: ['drug', 'name'],
      key: 'drug_name',
    },
    {
      title: '分类',
      dataIndex: ['drug', 'category'],
      key: 'category',
      width: 120,
    },
    {
      title: '当前库存',
      dataIndex: 'current_stock',
      key: 'current_stock',
      width: 100,
      align: 'right' as const,
      render: (stock: number) => (
        <span style={{ color: stock < 10 ? '#ff4d4f' : '#52c41a' }}>
          {stock}
        </span>
      ),
    },
    {
      title: '最小库存',
      dataIndex: 'min_stock_level',
      key: 'min_stock_level',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (record: any) => (
        <Tag color="red">库存不足</Tag>
      ),
    },
  ]

  return (
    <div className="p-6">
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>报表与分析</h2>
      {/* 日期选择和报表类型 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col>
            <span>报表类型：</span>
            <Select
              value={reportType}
              onChange={setReportType}
              style={{ width: 120 }}
            >
              <Select.Option value="sales">销售报表</Select.Option>
              <Select.Option value="inventory">库存报表</Select.Option>
              <Select.Option value="customer">客户报表</Select.Option>
            </Select>
          </Col>
          <Col>
            <span>时间范围：</span>
            <RangePicker
              value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
              onChange={(dates) => {
                if (dates) {
                  setDateRange([
                    dates[0]!.format('YYYY-MM-DD'),
                    dates[1]!.format('YYYY-MM-DD')
                  ])
                }
              }}
              style={{ width: 240 }}
            />
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总销售额"
              value={salesStats?.totalSales || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
              suffix={
                salesStats?.salesGrowth && parseFloat(salesStats.salesGrowth) > 0 ? (
                  <ArrowUpOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                )
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="订单数量"
              value={salesStats?.orderCount || 0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均订单金额"
              value={salesStats?.avgOrderValue || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="处方数量"
              value={salesStats?.totalPrescriptions || 0}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 客户统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="新增客户"
              value={customerStats?.newCustomers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="活跃客户"
              value={customerStats?.activeCustomers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="客户留存率"
              value={customerStats?.customerRetention || 0}
              suffix="%"
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 药品销售排行 */}
        <Col span={12}>
          <Card
            title="药品销售排行"
            style={{ marginBottom: 24 }}
          >
            <Table
              columns={drugRankingColumns}
              dataSource={drugRanking}
              pagination={false}
              rowKey="drugId"
              size="small"
            />
          </Card>
        </Col>

        {/* 库存预警 */}
        <Col span={12}>
          <Card title="库存预警">
            <Table
              columns={inventoryColumns}
              dataSource={inventoryAlerts}
              pagination={false}
              rowKey="id"
              size="small"
              locale={{ emptyText: '暂无库存预警' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ReportsAndAnalytics
