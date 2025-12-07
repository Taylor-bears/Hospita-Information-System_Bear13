import React, { useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, Modal, Form, message, Upload } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const { TextArea } = Input

const DrugInformation: React.FC = () => {
  const [searchForm] = Form.useForm()
  const [drugForm] = Form.useForm()
  const [selectedDrug, setSelectedDrug] = useState<any>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'add' | 'edit'>('add')

  // 获取药品列表
  const { data: drugs, refetch } = useQuery({
    queryKey: ['drugs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drugs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // 获取药品分类
  const { data: categories } = useQuery({
    queryKey: ['drug-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drug_categories')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    }
  })

  // 保存药品
  const handleSaveDrug = async (values: any) => {
    try {
      if (modalType === 'add') {
        const { error } = await supabase
          .from('drugs')
          .insert([{
            ...values,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])

        if (error) throw error
        message.success('药品添加成功')
      } else if (selectedDrug) {
        const { error } = await supabase
          .from('drugs')
          .update({
            ...values,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedDrug.id)

        if (error) throw error
        message.success('药品更新成功')
      }

      setModalVisible(false)
      refetch()
    } catch (error) {
      message.error('操作失败')
    }
  }

  // 删除药品
  const handleDeleteDrug = async (id: string) => {
    try {
      const { error } = await supabase
        .from('drugs')
        .delete()
        .eq('id', id)

      if (error) throw error
      message.success('药品删除成功')
      refetch()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green'
      case 'inactive': return 'red'
      case 'discontinued': return 'orange'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '启用'
      case 'inactive': return '禁用'
      case 'discontinued': return '停产'
      default: return status
    }
  }

  const columns = [
    {
      title: '药品编码',
      dataIndex: 'drug_code',
      key: 'drug_code',
      width: 120,
    },
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
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
      title: '生产厂家',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      ellipsis: true,
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number) => `¥${price?.toFixed(2) || '0.00'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedDrug(record)
              setModalType('edit')
              drugForm.setFieldsValue(record)
              setModalVisible(true)
            }}
          >
            编辑
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除药品 "${record.name}" 吗？`,
                onOk: () => handleDeleteDrug(record.id)
              })
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>药品信息管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setModalType('add')
            drugForm.resetFields()
            setModalVisible(true)
          }}
        >
          添加药品
        </Button>
      </div>
      {/* 搜索表单 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="name" label="药品名称">
            <Input placeholder="请输入药品名称" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select style={{ width: 150 }} allowClear placeholder="全部">
              {categories?.map((category: any) => (
                <Select.Option key={category.id} value={category.name}>
                  {category.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select style={{ width: 120 }} allowClear placeholder="全部">
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
              <Select.Option value="discontinued">停产</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />}>
              搜索
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 药品列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={drugs}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 添加/编辑药品模态框 */}
      <Modal
        title={modalType === 'add' ? '添加药品' : '编辑药品'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={drugForm}
          layout="vertical"
          onFinish={handleSaveDrug}
        >
          <Form.Item
            name="drug_code"
            label="药品编码"
            rules={[{ required: true, message: '请输入药品编码' }]}
          >
            <Input placeholder="请输入药品编码" />
          </Form.Item>

          <Form.Item
            name="name"
            label="药品名称"
            rules={[{ required: true, message: '请输入药品名称' }]}
          >
            <Input placeholder="请输入药品名称" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              {categories?.map((category: any) => (
                <Select.Option key={category.id} value={category.name}>
                  {category.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="specification"
            label="规格"
            rules={[{ required: true, message: '请输入规格' }]}
          >
            <Input placeholder="请输入规格" />
          </Form.Item>

          <Form.Item
            name="manufacturer"
            label="生产厂家"
            rules={[{ required: true, message: '请输入生产厂家' }]}
          >
            <Input placeholder="请输入生产厂家" />
          </Form.Item>

          <Form.Item
            name="price"
            label="单价"
            rules={[{ required: true, message: '请输入单价' }]}
          >
            <Input type="number" step="0.01" placeholder="请输入单价" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
              <Select.Option value="discontinued">停产</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item
            name="instructions"
            label="用法用量"
          >
            <TextArea rows={3} placeholder="请输入用法用量" />
          </Form.Item>

          <Form.Item
            name="contraindications"
            label="禁忌"
          >
            <TextArea rows={3} placeholder="请输入禁忌" />
          </Form.Item>

          <Form.Item
            name="side_effects"
            label="副作用"
          >
            <TextArea rows={3} placeholder="请输入副作用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DrugInformation
