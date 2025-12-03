import React, { useState } from 'react'
import { Card, Table, Tag, Button, Space, Input, Select, DatePicker, Modal, Form, message, Row, Col } from 'antd'
import { SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { TextArea } = Input

const PrescriptionManagement: React.FC = () => {
  const [searchForm] = Form.useForm()
  const [processForm] = Form.useForm()
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null)
  const [processModalVisible, setProcessModalVisible] = useState(false)

  // 获取处方列表
  const { data: prescriptions, refetch } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patient:users!prescriptions_patient_id_fkey(name, phone),
          doctor:users!prescriptions_doctor_id_fkey(name),
          prescription_items(
            *,
            drug:drugs(name, specification, manufacturer)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // 处理处方
  const handleProcessPrescription = async (values: any) => {
    if (!selectedPrescription) return

    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          status: values.action,
          processed_notes: values.notes,
          processed_at: new Date().toISOString(),
          processed_by: selectedPrescription.processed_by
        })
        .eq('id', selectedPrescription.id)

      if (error) throw error

      message.success('处方处理成功')
      setProcessModalVisible(false)
      refetch()
    } catch (error) {
      message.error('处方处理失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange'
      case 'approved': return 'green'
      case 'rejected': return 'red'
      case 'dispensed': return 'blue'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待处理'
      case 'approved': return '已审核'
      case 'rejected': return '已拒绝'
      case 'dispensed': return '已发药'
      default: return status
    }
  }

  const columns = [
    {
      title: '处方编号',
      dataIndex: 'prescription_number',
      key: 'prescription_number',
      width: 120,
    },
    {
      title: '患者信息',
      key: 'patient',
      render: (record: any) => (
        <div>
          <div>{record.patient?.name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.patient?.phone}</div>
        </div>
      ),
    },
    {
      title: '开方医生',
      key: 'doctor',
      render: (record: any) => record.doctor?.name,
    },
    {
      title: '诊断',
      dataIndex: 'diagnosis',
      key: 'diagnosis',
      ellipsis: true,
    },
    {
      title: '处方项目',
      key: 'items',
      render: (record: any) => (
        <div>
          {record.prescription_items?.map((item: any, index: number) => (
            <div key={index} style={{ fontSize: 12 }}>
              {item.drug?.name} × {item.quantity} {item.dosage}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => `¥${amount?.toFixed(2) || '0.00'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
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
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPrescription(record)
              setProcessModalVisible(true)
            }}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => {
                setSelectedPrescription(record)
                processForm.setFieldsValue({ action: 'approved' })
                setProcessModalVisible(true)
              }}
            >
              审核
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>处方管理</h2>
        <Button onClick={() => refetch()}>刷新</Button>
      </div>
      {/* 搜索表单 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="prescription_number" label="处方编号">
            <Input placeholder="请输入处方编号" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="patient_name" label="患者姓名">
            <Input placeholder="请输入患者姓名" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select style={{ width: 120 }} allowClear placeholder="全部">
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="approved">已审核</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
              <Select.Option value="dispensed">已发药</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="date_range" label="创建时间">
            <RangePicker style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />}>
              搜索
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 处方列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={prescriptions}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 处理处方模态框 */}
      <Modal
        title="处理处方"
        visible={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedPrescription && (
          <div>
            <Card title="处方信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <div><strong>处方编号:</strong> {selectedPrescription.prescription_number}</div>
                </Col>
                <Col span={8}>
                  <div><strong>患者:</strong> {selectedPrescription.patient?.name}</div>
                </Col>
                <Col span={8}>
                  <div><strong>电话:</strong> {selectedPrescription.patient?.phone}</div>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <div><strong>开方医生:</strong> {selectedPrescription.doctor?.name}</div>
                </Col>
                <Col span={8}>
                  <div><strong>诊断:</strong> {selectedPrescription.diagnosis}</div>
                </Col>
                <Col span={8}>
                  <div><strong>总金额:</strong> ¥{selectedPrescription.total_amount?.toFixed(2)}</div>
                </Col>
              </Row>
            </Card>

            <Card title="处方明细" style={{ marginBottom: 16 }}>
              <Table
                columns={[
                  { title: '药品名称', dataIndex: ['drug', 'name'], key: 'drug_name' },
                  { title: '规格', dataIndex: ['drug', 'specification'], key: 'specification' },
                  { title: '数量', dataIndex: 'quantity', key: 'quantity' },
                  { title: '用法用量', dataIndex: 'dosage', key: 'dosage' },
                  { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: (price: number) => `¥${price?.toFixed(2)}` },
                  { title: '小计', key: 'subtotal', render: (record: any) => `¥${(record.quantity * record.unit_price)?.toFixed(2)}` },
                ]}
                dataSource={selectedPrescription.prescription_items || []}
                pagination={false}
                rowKey="id"
              />
            </Card>

            {selectedPrescription.status === 'pending' && (
              <Form form={processForm} onFinish={handleProcessPrescription}>
                <Form.Item
                  name="action"
                  label="处理结果"
                  rules={[{ required: true, message: '请选择处理结果' }]}
                >
                  <Select placeholder="请选择处理结果">
                    <Select.Option value="approved">审核通过</Select.Option>
                    <Select.Option value="rejected">审核拒绝</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  name="notes"
                  label="处理备注"
                  rules={[{ required: true, message: '请输入处理备注' }]}
                >
                  <TextArea rows={3} placeholder="请输入处理备注" />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      提交
                    </Button>
                    <Button onClick={() => setProcessModalVisible(false)}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default PrescriptionManagement
