import React, { useState, useEffect } from 'react'
import { Card, Table, Button, InputNumber, Form, Input, Modal, message, Tag, Space, DatePicker, Select } from 'antd'
import { EditOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import moment from 'moment'

const { RangePicker } = DatePicker
const { Option } = Select

interface Medicine {
  id: string
  name: string
  generic_name: string
  category: string
  price: number
  manufacturer: string
  specification: string
  created_at: string
}

 

export default function PriceAdjustment() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [priceLogs, setPriceLogs] = useState<PriceLog[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Medicine | null>(null)
  const [adjustModalVisible, setAdjustModalVisible] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [adjustForm] = Form.useForm()
  const [searchForm] = Form.useForm()
  const { user } = useAuthStore()

  const fetchMedicines = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/medications')
      setMedicines(res.data || [])
    } catch (error) {
      message.error('获取药品列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchPriceLogs = async () => {
    setLogLoading(false)
  }

  const handleAdjustPrice = async (values: any) => {
    if (!user?.id) return

    try {
      const newPrice = values.new_price
      if (editingRecord) {
        await api.put(`/api/admin/medications/${editingRecord.id}`, {
          name: editingRecord.name,
          category: editingRecord.category,
          stock: (editingRecord as any).stock || 0,
          price: newPrice,
          status: 'active',
        })
      } else {
        await api.post('/api/admin/medications', {
          name: values.name,
          category: values.category || 'general',
          stock: 0,
          price: newPrice,
          status: 'active',
        })
      }

      message.success('价格调整成功')
      setAdjustModalVisible(false)
      setEditingRecord(null)
      adjustForm.resetFields()
      fetchMedicines()
    } catch (error) {
      message.error('价格调整失败')
    }
  }

  const handleSearch = async (values: any) => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/medications')
      let list: any[] = res.data || []
      if (values.name) {
        list = list.filter(m => (m.name || '').includes(values.name))
      }
      if (values.category && values.category !== 'all') {
        list = list.filter(m => m.category === values.category)
      }
      setMedicines(list)
    } catch (error) {
      message.error('搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const showAdjustModal = (record: Medicine) => {
    setEditingRecord(record)
    adjustForm.setFieldsValue({
      current_price: record.price,
      new_price: record.price
    })
    setAdjustModalVisible(true)
  }

  const showLogModal = async () => {
    setLogModalVisible(true)
  }

  const getPriceChangeTag = (oldPrice: number, newPrice: number) => {
    const change = newPrice - oldPrice
    const changePercent = ((change / oldPrice) * 100).toFixed(1)
    
    if (change > 0) {
      return <Tag color="red">+{change.toFixed(2)} ({changePercent}%)</Tag>
    } else if (change < 0) {
      return <Tag color="green">{change.toFixed(2)} ({changePercent}%)</Tag>
    }
    return <Tag color="blue">无变化</Tag>
  }

  const columns = [
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: Medicine) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-gray-500 text-sm">{record.generic_name}</div>
        </div>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: [
        { text: '处方药', value: 'prescription' },
        { text: '非处方药', value: 'otc' },
        { text: '中药', value: 'tcm' },
        { text: '西药', value: 'western' },
        { text: '保健品', value: 'health' }
      ],
      onFilter: (value: string, record: Medicine) => record.category === value,
      render: (category: string) => {
        const categoryMap = {
          prescription: '处方药',
          otc: '非处方药',
          tcm: '中药',
          western: '西药',
          health: '保健品'
        }
        return categoryMap[category as keyof typeof categoryMap] || category
      }
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 150
    },
    {
      title: '生产厂家',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 200,
      ellipsis: true
    },
    {
      title: '当前价格',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price: number) => (
        <span className="text-lg font-medium text-blue-600">¥{price.toFixed(2)}</span>
      ),
      sorter: (a: Medicine, b: Medicine) => a.price - b.price
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => moment(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a: Medicine, b: Medicine) => 
        moment(a.created_at).unix() - moment(b.created_at).unix()
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Medicine) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showAdjustModal(record)}
          >
            调价
          </Button>
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => showLogModal(record.id)}
          >
            历史
          </Button>
          <Button
            danger
            size="small"
            onClick={async () => {
              try {
                await api.delete(`/api/admin/medications/${record.id}`)
                message.success('已下架')
                fetchMedicines()
              } catch (e) {
                message.error('下架失败')
              }
            }}
          >
            下架
          </Button>
        </Space>
      )
    }
  ]

  const logColumns: any[] = []

  useEffect(() => {
    fetchMedicines()
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">药品价格管理</h1>
        <p className="text-gray-600">管理药品价格，记录价格调整历史</p>
      </div>

      {/* 搜索表单 */}
      <Card className="mb-6">
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="name" label="药品名称">
            <Input placeholder="输入药品名称" prefix={<SearchOutlined />} />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="all">
            <Select style={{ width: 120 }}>
              <Option value="all">全部分类</Option>
              <Option value="prescription">处方药</Option>
              <Option value="otc">非处方药</Option>
              <Option value="tcm">中药</Option>
              <Option value="western">西药</Option>
              <Option value="health">保健品</Option>
            </Select>
          </Form.Item>
          <Form.Item name="date_range" label="创建时间">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button onClick={() => {
                searchForm.resetFields()
                fetchMedicines()
              }}>
                重置
              </Button>
              <Button icon={<HistoryOutlined />} onClick={() => showLogModal()}>
                查看全部调价记录
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 药品列表 */}
      <Card title="药品价格列表" extra={<Button type="primary" onClick={() => setAdjustModalVisible(true)}>新增药品</Button>}>
        <Table
          columns={columns}
          dataSource={medicines}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 价格调整模态框 */}
      <Modal
        title="调整药品价格"
        visible={adjustModalVisible}
        onCancel={() => {
          setAdjustModalVisible(false)
          setEditingRecord(null)
          adjustForm.resetFields()
        }}
        footer={null}
        width={500}
      >
        {(
          <Form
            form={adjustForm}
            layout="vertical"
            onFinish={handleAdjustPrice}
            initialValues={{
              current_price: editingRecord?.price,
              new_price: editingRecord?.price
            }}
          >
            <Form.Item label="药品名称" name="name" rules={[{ required: !editingRecord, message: '请输入药品名称' }]}> 
              <Input defaultValue={editingRecord?.name} />
            </Form.Item>
            <Form.Item label="当前价格">
              <Input value={editingRecord ? `¥${(editingRecord.price || 0).toFixed(2)}` : ''} disabled />
            </Form.Item>
            <Form.Item
              name="new_price"
              label="新价格"
              rules={[
                { required: true, message: '请输入新价格' },
                { type: 'number', min: 0.01, message: '价格必须大于0' }
              ]}
            >
              <InputNumber
                min={0.01}
                precision={2}
                style={{ width: '100%' }}
                placeholder="请输入新价格"
              />
            </Form.Item>
            <Form.Item label="分类" name="category">
              <Input defaultValue={editingRecord?.category} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
          保存
        </Button>
                <Button onClick={() => {
                  setAdjustModalVisible(false)
                  setEditingRecord(null)
                  adjustForm.resetFields()
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 价格调整历史模态框 */}
      <Modal
        title="价格调整历史"
        visible={logModalVisible}
        onCancel={() => {
          setLogModalVisible(false)
          setPriceLogs([])
        }}
        footer={null}
        width={1000}
      >
        <div>暂无记录</div>
      </Modal>
    </div>
  )
}
