import React, { useState } from 'react'
import { Card, Table, Button, Input, Space, Tag, Modal, Form, InputNumber, DatePicker, Select, message, Row, Col, Statistic, Typography } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, StockOutlined, WarningOutlined, MedicineBoxOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryAPI, drugAPI } from '../../lib/supabase'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

interface StockMovementForm {
  drugId: string
  quantity: number
  movementType: 'inbound' | 'outbound'
  batchNumber?: string
  expiryDate?: any
  supplier?: string
  location?: string
  reason?: string
}

export default function InventoryManagement() {
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showLowStock, setShowLowStock] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [movementModalVisible, setMovementModalVisible] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<any>(null)
  
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [movementForm] = Form.useForm()

  // 获取库存数据
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', searchText, selectedCategory, showLowStock],
    queryFn: async () => {
      const params: any = {
        pageSize: 100,
        keyword: searchText || undefined,
        category: selectedCategory || undefined,
        lowStock: showLowStock || undefined
      }
      
      const { data, error } = await inventoryAPI.getInventory(params)
      if (error) throw error
      return data || []
    }
  })

  // 获取药品分类
  const { data: drugCategories } = useQuery({
    queryKey: ['drug-categories'],
    queryFn: async () => {
      const { data, error } = await drugAPI.getDrugs({ pageSize: 1000 })
      if (error) throw error
      
      const categories = [...new Set(data?.map((drug: any) => drug.category).filter(Boolean))]
      return categories || []
    }
  })

  // 更新库存数量
  const updateInventoryMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingRecord) {
        // 编辑现有库存记录
        const { error } = await inventoryAPI.updateStock(
          editingRecord.id,
          values.quantity - editingRecord.quantity,
          values.quantity > editingRecord.quantity ? 'inbound' : 'outbound',
          undefined,
          values.reason
        )
        if (error) throw error
      } else {
        // 新增库存记录
        // 这里需要实现新增库存的逻辑
        message.warning('新增库存功能待实现')
      }
    },
    onSuccess: () => {
      message.success('库存更新成功')
      setModalVisible(false)
      setEditingRecord(null)
      form.resetFields()
      queryClient.invalidateQueries(['inventory'])
    },
    onError: (error: any) => {
      message.error(error.message || '库存更新失败')
    }
  })

  // 库存变动
  const stockMovementMutation = useMutation({
    mutationFn: async (values: StockMovementForm) => {
      if (!selectedInventory) return
      
      const movementQuantity = values.movementType === 'inbound' ? values.quantity : -values.quantity
      
      const { error } = await inventoryAPI.updateStock(
        selectedInventory.id,
        movementQuantity,
        values.movementType,
        undefined,
        values.reason
      )
      
      if (error) throw error
    },
    onSuccess: () => {
      message.success('库存变动成功')
      setMovementModalVisible(false)
      setSelectedInventory(null)
      movementForm.resetFields()
      queryClient.invalidateQueries(['inventory'])
    },
    onError: (error: any) => {
      message.error(error.message || '库存变动失败')
    }
  })

  const handleEdit = (record: any) => {
    setEditingRecord(record)
    form.setFieldsValue({
      ...record,
      expiryDate: record.expiry_date ? dayjs(record.expiry_date) : null
    })
    setModalVisible(true)
  }

  const handleStockMovement = (record: any, type: 'inbound' | 'outbound') => {
    setSelectedInventory(record)
    movementForm.setFieldsValue({
      drugId: record.drug_id,
      movementType: type
    })
    setMovementModalVisible(true)
  }

  const handleModalOk = () => {
    form.validateFields().then(values => {
      updateInventoryMutation.mutate(values)
    })
  }

  const handleMovementModalOk = () => {
    movementForm.validateFields().then(values => {
      stockMovementMutation.mutate(values)
    })
  }

  const handleModalCancel = () => {
    setModalVisible(false)
    setEditingRecord(null)
    form.resetFields()
  }

  const handleMovementModalCancel = () => {
    setMovementModalVisible(false)
    setSelectedInventory(null)
    movementForm.resetFields()
  }

  const columns = [
    {
      title: '药品信息',
      dataIndex: 'drugs',
      key: 'drug_info',
      render: (drug: any) => (
        <div>
          <Text strong>{drug?.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {drug?.specification}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            厂商: {drug?.manufacturer}
          </Text>
        </div>
      )
    },
    {
      title: '分类',
      dataIndex: ['drugs', 'category'],
      key: 'category',
      render: (category: string) => <Tag>{category}</Tag>
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number, record: any) => {
        const isLowStock = quantity <= record.min_stock
        return (
          <div>
            <Text style={{ color: isLowStock ? '#f5222d' : undefined }}>
              {quantity} {record.drugs?.unit}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              预警值: {record.min_stock}
            </Text>
          </div>
        )
      }
    },
    {
      title: '价格',
      dataIndex: ['drugs', 'price'],
      key: 'price',
      render: (price: number) => <Text strong>¥{price?.toFixed(2)}</Text>
    },
    {
      title: '有效期',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (date: string) => {
        if (!date) return '-'
        const expiryDate = dayjs(date)
        const isExpired = expiryDate.isBefore(dayjs())
        const isNearExpiry = expiryDate.isBefore(dayjs().add(30, 'day'))
        
        return (
          <Text style={{ 
            color: isExpired ? '#f5222d' : isNearExpiry ? '#fa8c16' : undefined 
          }}>
            {expiryDate.format('YYYY-MM-DD')}
          </Text>
        )
      }
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) => {
        const isLowStock = record.quantity <= record.min_stock
        const isExpired = record.expiry_date && dayjs(record.expiry_date).isBefore(dayjs())
        const isNearExpiry = record.expiry_date && dayjs(record.expiry_date).isBefore(dayjs().add(30, 'day'))
        
        return (
          <Space>
            {isLowStock && <Tag color="red">低库存</Tag>}
            {isExpired && <Tag color="red">已过期</Tag>}
            {isNearExpiry && !isExpired && <Tag color="orange">近效期</Tag>}
            {!isLowStock && !isExpired && !isNearExpiry && <Tag color="green">正常</Tag>}
          </Space>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<StockOutlined />}
            onClick={() => handleStockMovement(record, 'inbound')}
          >
            入库
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={() => handleStockMovement(record, 'outbound')}
          >
            出库
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="!mb-0">药品库存管理</Title>
            <Text type="secondary">管理药房药品库存信息</Text>
          </Col>
          <Col>
            <Space>
              <Button 
                type={showLowStock ? "primary" : "default"}
                icon={<WarningOutlined />}
                onClick={() => setShowLowStock(!showLowStock)}
              >
                {showLowStock ? "显示全部" : "低库存"}
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
              >
                新增库存
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="药品品种"
              value={inventoryData?.length || 0}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="低库存药品"
              value={inventoryData?.filter(item => item.quantity <= item.min_stock).length || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="近效期药品"
              value={inventoryData?.filter(item => 
                item.expiry_date && dayjs(item.expiry_date).isBefore(dayjs().add(30, 'day'))
              ).length || 0}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="库存总值"
              value={inventoryData?.reduce((sum, item) => sum + (item.quantity * item.drugs?.price || 0), 0) || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <Card className="mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Input
              placeholder="搜索药品名称、通用名"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Select
              placeholder="选择分类"
              style={{ width: '100%' }}
              value={selectedCategory}
              onChange={setSelectedCategory}
              allowClear
            >
              {drugCategories?.map((category: string) => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 库存列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={inventoryData || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title="编辑库存"
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={updateInventoryMutation.isLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="drugId" label="药品" rules={[{ required: true }]}>
            <Select placeholder="选择药品" disabled={!!editingRecord}>
              {/* 这里需要加载药品列表 */}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="库存数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minStock" label="预警数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiryDate" label="有效期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <Input placeholder="如：A区-1号货架" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input placeholder="供应商名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 库存变动模态框 */}
      <Modal
        title={`${selectedInventory ? (movementForm.getFieldValue('movementType') === 'inbound' ? '入库' : '出库') : '库存变动'}`}
        visible={movementModalVisible}
        onOk={handleMovementModalOk}
        onCancel={handleMovementModalCancel}
        confirmLoading={stockMovementMutation.isLoading}
      >
        <Form form={movementForm} layout="vertical">
          <Form.Item name="movementType" label="变动类型" rules={[{ required: true }]}>
            <Select>
              <Option value="inbound">入库</Option>
              <Option value="outbound">出库</Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="原因/备注">
            <Input.TextArea rows={3} placeholder="请输入变动原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}