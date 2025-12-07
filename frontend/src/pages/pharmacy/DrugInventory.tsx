import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Space, message, Card, Row, Col, Statistic, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, MedicineBoxOutlined, StockOutlined } from '@ant-design/icons'
import { supabase } from '../../utils/supabase'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { TextArea } = Input
const { Option } = Select

interface Medicine {
  id: string
  name: string
  specification: string
  unit: string
  price: number
  stock: number
  min_stock: number
  max_stock: number
  category: string
  manufacturer: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  description?: string
}

interface StockLog {
  id: string
  medicine_id: string
  medicine_name: string
  type: 'in' | 'out' | 'adjust'
  quantity: number
  previous_stock: number
  new_stock: number
  reason: string
  created_at: string
  operator_name: string
}

const DrugInventory: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')

  const fetchMedicines = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('medicines')
        .select('*')
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('获取药品列表失败:', error)
        message.error('获取药品列表失败')
        return
      }

      setMedicines(data || [])
    } catch (error) {
      console.error('获取药品列表失败:', error)
      message.error('获取药品列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStockLogs = async (medicineId?: string) => {
    try {
      let query = supabase
        .from('stock_logs')
        .select(`
          *,
          medicines!stock_logs_medicine_id_fkey (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (medicineId) {
        query = query.eq('medicine_id', medicineId)
      }

      const { data, error } = await query

      if (error) {
        console.error('获取库存记录失败:', error)
        return
      }

      const formattedLogs = data.map(item => ({
        id: item.id,
        medicine_id: item.medicine_id,
        medicine_name: item.medicines?.name || '未知药品',
        type: item.type,
        quantity: item.quantity,
        previous_stock: item.previous_stock,
        new_stock: item.new_stock,
        reason: item.reason,
        created_at: item.created_at,
        operator_name: item.operator_name
      }))

      setStockLogs(formattedLogs)
    } catch (error) {
      console.error('获取库存记录失败:', error)
    }
  }

  useEffect(() => {
    fetchMedicines()
  }, [])

  const handleCreateMedicine = () => {
    setSelectedMedicine(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditMedicine = (medicine: Medicine) => {
    setSelectedMedicine(medicine)
    form.setFieldsValue({
      name: medicine.name,
      specification: medicine.specification,
      unit: medicine.unit,
      price: medicine.price,
      stock: medicine.stock,
      min_stock: medicine.min_stock,
      max_stock: medicine.max_stock,
      category: medicine.category,
      manufacturer: medicine.manufacturer,
      status: medicine.status,
      description: medicine.description
    })
    setModalVisible(true)
  }

  const handleDeleteMedicine = (medicineId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个药品吗？删除后将无法恢复。',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('medicines')
            .delete()
            .eq('id', medicineId)

          if (error) {
            console.error('删除药品失败:', error)
            message.error('删除药品失败')
            return
          }

          message.success('药品已删除')
          fetchMedicines()
        } catch (error) {
          console.error('删除药品失败:', error)
          message.error('删除药品失败')
        }
      }
    })
  }

  const handleSubmitMedicine = async (values: any) => {
    try {
      if (selectedMedicine) {
        // 更新药品
        const { error } = await supabase
          .from('medicines')
          .update({
            name: values.name,
            specification: values.specification,
            unit: values.unit,
            price: values.price,
            stock: values.stock,
            min_stock: values.min_stock,
            max_stock: values.max_stock,
            category: values.category,
            manufacturer: values.manufacturer,
            status: values.status,
            description: values.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedMedicine.id)

        if (error) {
          console.error('更新药品失败:', error)
          message.error('更新药品失败')
          return
        }

        message.success('药品已更新')
      } else {
        // 创建新药品
        const { error } = await supabase
          .from('medicines')
          .insert({
            name: values.name,
            specification: values.specification,
            unit: values.unit,
            price: values.price,
            stock: values.stock,
            min_stock: values.min_stock,
            max_stock: values.max_stock,
            category: values.category,
            manufacturer: values.manufacturer,
            status: values.status,
            description: values.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('创建药品失败:', error)
          message.error('创建药品失败')
          return
        }

        message.success('药品已创建')
      }

      setModalVisible(false)
      fetchMedicines()
    } catch (error) {
      console.error('保存药品失败:', error)
      message.error('保存药品失败')
    }
  }

  const handleAdjustStock = async (medicineId: string, adjustment: number, reason: string) => {
    try {
      // 获取当前库存
      const { data: medicine, error: fetchError } = await supabase
        .from('medicines')
        .select('stock, name')
        .eq('id', medicineId)
        .single()

      if (fetchError || !medicine) {
        console.error('获取药品信息失败:', fetchError)
        message.error('获取药品信息失败')
        return
      }

      const newStock = medicine.stock + adjustment

      // 更新库存
      const { error: updateError } = await supabase
        .from('medicines')
        .update({ stock: newStock })
        .eq('id', medicineId)

      if (updateError) {
        console.error('更新库存失败:', updateError)
        message.error('更新库存失败')
        return
      }

      // 记录库存变动
      const { error: logError } = await supabase
        .from('stock_logs')
        .insert({
          medicine_id: medicineId,
          type: adjustment > 0 ? 'in' : 'out',
          quantity: Math.abs(adjustment),
          previous_stock: medicine.stock,
          new_stock: newStock,
          reason: reason,
          operator_name: '药房管理员', // 应该从当前用户获取
          created_at: new Date().toISOString()
        })

      if (logError) {
        console.error('记录库存变动失败:', logError)
      }

      message.success('库存已调整')
      fetchMedicines()
    } catch (error) {
      console.error('调整库存失败:', error)
      message.error('调整库存失败')
    }
  }

  const showStockAdjustment = (medicine: Medicine) => {
    Modal.confirm({
      title: '调整库存',
      content: (
        <div>
          <p>当前库存：{medicine.stock} {medicine.unit}</p>
          <InputNumber
            placeholder="调整数量"
            style={{ width: '100%', marginTop: 16 }}
            onChange={(value) => {
              // 这里需要更好的处理方式，暂时存储在临时变量中
              (window as any).tempAdjustment = value
            }}
          />
          <Input.TextArea
            placeholder="调整原因"
            rows={3}
            style={{ marginTop: 16 }}
            onChange={(e) => {
              (window as any).tempReason = e.target.value
            }}
          />
        </div>
      ),
      onOk: async () => {
        const adjustment = (window as any).tempAdjustment
        const reason = (window as any).tempReason
        
        if (!adjustment || !reason) {
          message.error('请输入调整数量和原因')
          return Promise.reject()
        }

        await handleAdjustStock(medicine.id, adjustment, reason)
        delete (window as any).tempAdjustment
        delete (window as any).tempReason
      },
      onCancel: () => {
        delete (window as any).tempAdjustment
        delete (window as any).tempReason
      }
    })
  }

  const showStockLogs = (medicine: Medicine) => {
    fetchStockLogs(medicine.id)
    setLogModalVisible(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green'
      case 'inactive':
        return 'red'
      default:
        return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '启用'
      case 'inactive':
        return '停用'
      default:
        return status
    }
  }

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock <= minStock) {
      return { color: 'red', text: '库存不足' }
    } else if (stock <= minStock * 2) {
      return { color: 'orange', text: '库存偏低' }
    } else {
      return { color: 'green', text: '库存充足' }
    }
  }

  const filteredMedicines = medicines.filter(medicine => {
    const matchesSearch = medicine.name.toLowerCase().includes(searchText.toLowerCase()) ||
                         medicine.specification.toLowerCase().includes(searchText.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || medicine.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || medicine.status === statusFilter
    
    let matchesStock = true
    if (stockFilter === 'low') {
      matchesStock = medicine.stock <= medicine.min_stock
    } else if (stockFilter === 'normal') {
      matchesStock = medicine.stock > medicine.min_stock && medicine.stock <= medicine.min_stock * 2
    } else if (stockFilter === 'high') {
      matchesStock = medicine.stock > medicine.min_stock * 2
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesStock
  })

  const categories = ['处方药', '非处方药', '中药', '西药', '保健品', '医疗器械']

  const columns = [
    {
      title: '药品信息',
      key: 'medicine',
      render: (record: Medicine) => (
        <div>
          <div className="font-medium">{record.name}</div>
          <div className="text-gray-500 text-sm">{record.specification}</div>
          <div className="text-gray-500 text-sm">{record.manufacturer}</div>
        </div>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="blue">{category}</Tag>
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => <span className="font-medium text-red-600">¥{price.toFixed(2)}</span>
    },
    {
      title: '库存',
      key: 'stock',
      render: (record: Medicine) => {
        const stockStatus = getStockStatus(record.stock, record.min_stock)
        return (
          <div>
            <span className={`font-medium ${stockStatus.color === 'red' ? 'text-red-600' : stockStatus.color === 'orange' ? 'text-orange-600' : 'text-green-600'}`}>
              {record.stock}
            </span>
            <span className="text-gray-500 ml-1">{record.unit}</span>
            <div className="text-xs text-gray-400">{stockStatus.text}</div>
          </div>
        )
      }
    },
    {
      title: '最低库存',
      key: 'min_stock',
      render: (record: Medicine) => (
        <span>{record.min_stock} {record.unit}</span>
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
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => (
        <span>{dayjs(text).format('MM月DD日 HH:mm')}</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Medicine) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditMedicine(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            icon={<StockOutlined />}
            onClick={() => showStockAdjustment(record)}
          >
            调库存
          </Button>
          <Button
            type="text"
            icon={<SearchOutlined />}
            onClick={() => showStockLogs(record)}
          >
            库存记录
          </Button>
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteMedicine(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  const logColumns = [
    {
      title: '药品名称',
      dataIndex: 'medicine_name',
      key: 'medicine_name',
      render: (text: string) => <span className="font-medium">{text}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'in' ? 'green' : type === 'out' ? 'red' : 'orange'}>
          {type === 'in' ? '入库' : type === 'out' ? '出库' : '调整'}
        </Tag>
      )
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => <span className="font-medium">{quantity}</span>
    },
    {
      title: '原库存',
      dataIndex: 'previous_stock',
      key: 'previous_stock'
    },
    {
      title: '新库存',
      dataIndex: 'new_stock',
      key: 'new_stock',
      render: (new_stock: number) => <span className="font-medium text-blue-600">{new_stock}</span>
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (text: string) => <span className="text-gray-600">{text}</span>
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name'
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => (
        <span>{dayjs(text).format('MM月DD日 HH:mm')}</span>
      )
    }
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">药品库存管理</h1>
        <p className="text-gray-600">管理药品信息和库存</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="药品总数"
              value={medicines.length}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="库存不足"
              value={medicines.filter(m => m.stock <= m.min_stock).length}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<StockOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="启用药品"
              value={medicines.filter(m => m.status === 'active').length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="停用药品"
              value={medicines.filter(m => m.status === 'inactive').length}
              valueStyle={{ color: '#cf1322' }}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选器和操作 */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium mb-1">搜索药品</label>
              <Input
                placeholder="输入药品名称或规格"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
                prefix={<SearchOutlined />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">分类筛选</label>
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 120 }}
              >
                <Option value="all">全部分类</Option>
                {categories.map(category => (
                  <Option key={category} value={category}>{category}</Option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">状态筛选</label>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 100 }}
              >
                <Option value="all">全部状态</Option>
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">库存筛选</label>
              <Select
                value={stockFilter}
                onChange={setStockFilter}
                style={{ width: 120 }}
              >
                <Option value="all">全部库存</Option>
                <Option value="low">库存不足</Option>
                <Option value="normal">库存正常</Option>
                <Option value="high">库存充足</Option>
              </Select>
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateMedicine}
          >
            新增药品
          </Button>
        </div>
      </Card>

      {/* 药品列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredMedicines}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 药品编辑模态框 */}
      <Modal
        title={selectedMedicine ? '编辑药品' : '新增药品'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            保存
          </Button>
        ]}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitMedicine}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="药品名称"
                name="name"
                rules={[{ required: true, message: '请输入药品名称' }]}
              >
                <Input placeholder="请输入药品名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="规格"
                name="specification"
                rules={[{ required: true, message: '请输入药品规格' }]}
              >
                <Input placeholder="如：10mg*24片" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="单位"
                name="unit"
                rules={[{ required: true, message: '请输入单位' }]}
              >
                <Input placeholder="如：盒、瓶、支" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="价格"
                name="price"
                rules={[{ required: true, message: '请输入价格' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="请输入价格"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="分类"
                name="category"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select placeholder="请选择分类">
                  {categories.map(category => (
                    <Option key={category} value={category}>{category}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="当前库存"
                name="stock"
                rules={[{ required: true, message: '请输入库存数量' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="请输入库存数量"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="最低库存"
                name="min_stock"
                rules={[{ required: true, message: '请输入最低库存' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="最低库存"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="最高库存"
                name="max_stock"
                rules={[{ required: true, message: '请输入最高库存' }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="最高库存"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="生产厂家"
            name="manufacturer"
            rules={[{ required: true, message: '请输入生产厂家' }]}
          >
            <Input placeholder="请输入生产厂家" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="药品描述"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="请输入药品描述（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 库存记录模态框 */}
      <Modal
        title="库存变动记录"
        visible={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Table
          columns={logColumns}
          dataSource={stockLogs}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Modal>
    </div>
  )
}

export default DrugInventory