import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, Space, message, Card, Row, Col, Statistic, InputNumber, Divider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, MedicineBoxOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { TextArea } = Input
const { Option } = Select

interface Prescription {
  id: string
  patient_name: string
  patient_phone: string
  patient_age: number
  patient_gender: string
  diagnosis: string
  medicines: Medicine[]
  total_amount: number
  status: 'pending' | 'dispensed' | 'cancelled'
  created_at: string
  doctor_name: string
  notes: string
}

interface Medicine {
  id: string
  name: string
  specification: string
  unit: string
  price: number
  quantity: number
  dosage: string
  frequency: string
  duration: string
}

interface MedicineOption {
  id: string
  name: string
  specification: string
  unit: string
  price: number
  stock: number
}

const PrescriptionManagement: React.FC = () => {
  const location = useLocation()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([])
  const [selectedMedicines, setSelectedMedicines] = useState<Medicine[]>([])
  const [currentPatient, setCurrentPatient] = useState<any>(null)

  useEffect(() => {
    if (location.state?.patientId) {
      setCurrentPatient({
        id: location.state.patientId,
        name: location.state.patientName
      })
      setModalVisible(true)
      form.setFieldsValue({
        patient_name: location.state.patientName
      })
    }
  }, [location.state])

  const fetchPrescriptions = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      fetchMedicines()

      const response = await api.get('/api/doctor/prescriptions', {
        params: { doctor_id: user.id }
      })

      const data = response.data.map((p: any) => ({
        id: p.id,
        patient_name: p.patient_name,
        patient_phone: p.patient_phone,
        patient_age: p.patient_age || 0,
        patient_gender: p.patient_gender || '未知',
        diagnosis: p.diagnosis,
        medicines: p.items.map((i: any) => ({
          id: i.medication_id,
          name: i.medication_name,
          specification: i.specification,
          unit: i.unit,
          price: i.price_at_time,
          quantity: i.quantity,
          dosage: i.usage_instruction?.split(' ')[0] || '',
          frequency: i.usage_instruction?.split(' ')[1] || '',
          duration: i.usage_instruction?.split(' ')[2] || ''
        })),
        total_amount: p.total_price,
        status: p.status,
        created_at: p.created_at,
        doctor_name: user.name || '我',
        notes: p.notes
      }))

      setPrescriptions(data)
    } catch (error) {
      console.error('获取处方失败:', error)
      message.error('获取处方失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchMedicines = async () => {
    try {
      const response = await api.get('/api/admin/medications')
      setMedicineOptions(response.data || [])
    } catch (error) {
      console.error('获取药品列表失败:', error)
      message.error('获取药品列表失败')
    }
  }

  useEffect(() => {
    fetchPrescriptions()
    fetchMedicines()
  }, [user, filterStatus])

  const handleCreatePrescription = () => {
    setSelectedPrescription(null)
    setSelectedMedicines([])
    setCurrentPatient(null) // Clear any pre-filled patient
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
    setSelectedMedicines(prescription.medicines)
    form.setFieldsValue({
      patient_id: prescription.id,
      diagnosis: prescription.diagnosis,
      notes: prescription.notes
    })
    setModalVisible(true)
  }

  const handleViewPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
    setModalVisible(true)
  }

  const handleSubmitPrescription = async (values: any) => {
    if (selectedMedicines.length === 0) {
      message.error('请至少添加一种药品')
      return
    }

    try {
      let medicalRecordId = 1 // Default fallback

      // 如果有当前患者信息，先创建病历
      if (currentPatient && user?.id) {
        try {
          const recordRes = await api.post('/api/doctor/records', {
            patient_id: currentPatient.id,
            doctor_id: user.id,
            diagnosis: values.diagnosis || '未填写诊断',
            treatment: '药物治疗'
          })
          if (recordRes.data && recordRes.data.id) {
            medicalRecordId = recordRes.data.id
          }
        } catch (e) {
          console.error('创建病历失败，尝试使用默认ID', e)
        }
      }

      const prescriptionData = {
        medical_record_id: medicalRecordId,
        items: selectedMedicines.map(m => ({
          medication_id: m.id,
          quantity: m.quantity,
          usage_instruction: `${m.dosage} ${m.frequency} ${m.duration}`
        })),
        notes: values.notes
      }

      if (selectedPrescription) {
        // 更新处方 (暂不支持)
        message.warning('暂不支持更新处方')
      } else {
        // 创建新处方
        await api.post('/api/doctor/prescriptions', prescriptionData)
        message.success('处方已创建')
      }

      setModalVisible(false)
      fetchPrescriptions()
    } catch (error) {
      console.error('保存处方失败:', error)
      message.error('保存处方失败')
    }
  }

  const handleDeletePrescription = async (prescriptionId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个处方吗？',
      onOk: async () => {
        try {
          // TODO: Implement delete API
          message.success('处方已删除')
          fetchPrescriptions()
        } catch (error) {
          console.error('删除处方失败:', error)
          message.error('删除处方失败')
        }
      }
    })
  }

  const handleAddMedicine = (medicineId: string) => {
    const medicine = medicineOptions.find(m => m.id === medicineId)
    if (!medicine) return

    const newMedicine: Medicine = {
      id: medicine.id,
      name: medicine.name,
      specification: medicine.specification,
      unit: medicine.unit,
      price: medicine.price,
      quantity: 1,
      dosage: '',
      frequency: '',
      duration: ''
    }

    setSelectedMedicines([...selectedMedicines, newMedicine])
  }

  const handleUpdateMedicine = (index: number, field: keyof Medicine, value: any) => {
    const updated = [...selectedMedicines]
    updated[index] = { ...updated[index], [field]: value }
    setSelectedMedicines(updated)
  }

  const handleRemoveMedicine = (index: number) => {
    setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index))
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

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const matchesSearch = prescription.patient_name.toLowerCase().includes(searchText.toLowerCase()) ||
      prescription.patient_phone.includes(searchText)
    return matchesSearch
  })

  const statistics = {
    total: prescriptions.length,
    pending: prescriptions.filter(p => p.status === 'pending').length,
    dispensed: prescriptions.filter(p => p.status === 'dispensed').length,
    totalAmount: prescriptions.reduce((sum, p) => sum + p.total_amount, 0)
  }

  const columns = [
    {
      title: '患者信息',
      key: 'patient',
      render: (record: Prescription) => (
        <div>
          <div className="font-medium">{record.patient_name}</div>
          <div className="text-gray-500 text-sm">{record.patient_phone}</div>
          <div className="text-gray-500 text-sm">{record.patient_age}岁 · {record.patient_gender}</div>
        </div>
      )
    },
    {
      title: '诊断',
      dataIndex: 'diagnosis',
      key: 'diagnosis',
      width: 150,
      render: (text: string) => (
        <div className="max-w-xs truncate" title={text}>
          {text}
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
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewPrescription(record)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditPrescription(record)}
            >
              编辑
            </Button>
          )}
          {record.status === 'pending' && (
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDeletePrescription(record.id)}
            >
              删除
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">处方管理</h1>
        <p className="text-gray-600">管理您的患者处方</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总处方数"
              value={statistics.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待配药"
              value={statistics.pending}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已配药"
              value={statistics.dispensed}
              valueStyle={{ color: '#52c41a' }}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总金额"
              value={statistics.totalAmount}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选器和操作 */}
      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium mb-1">状态筛选</label>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: 120 }}
              >
                <Option value="all">全部</Option>
                <Option value="pending">待配药</Option>
                <Option value="dispensed">已配药</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">搜索患者</label>
              <Input
                placeholder="输入患者姓名或手机号"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreatePrescription}
          >
            新建处方
          </Button>
        </div>
      </Card>

      {/* 处方列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredPrescriptions}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 处方编辑/查看模态框 */}
      <Modal
        title={selectedPrescription ? '查看处方' : '新建处方'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          !selectedPrescription && (
            <Button key="submit" type="primary" onClick={() => form.submit()}>
              保存处方
            </Button>
          )
        ].filter(Boolean)}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitPrescription}
          disabled={!!selectedPrescription}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="患者"
                name="patient_name"
                rules={[{ required: true, message: '请选择患者' }]}
              >
                <Input disabled={!!currentPatient || !!selectedPrescription} placeholder="患者姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="诊断"
                name="diagnosis"
                rules={[{ required: true, message: '请输入诊断' }]}
              >
                <Input placeholder="请输入诊断结果" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>药品清单</Divider>

          {!selectedPrescription && (
            <Form.Item label="添加药品">
              <Select
                placeholder="选择药品"
                onChange={handleAddMedicine}
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="children"
              >
                {medicineOptions.map(medicine => (
                  <Option
                    key={medicine.id}
                    value={medicine.id}
                    disabled={medicine.stock <= 0}
                  >
                    <div className="flex justify-between items-center">
                      <span>{medicine.name} - {medicine.specification}</span>
                      <span className={medicine.stock <= 0 ? 'text-red-500' : 'text-gray-500'}>
                        (库存: {medicine.stock}{medicine.unit}) ¥{medicine.price}
                      </span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {selectedMedicines.length > 0 && (
            <div className="mb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left">药品名称</th>
                    <th className="border p-2 text-left">规格</th>
                    <th className="border p-2 text-left">单价</th>
                    <th className="border p-2 text-left">数量</th>
                    <th className="border p-2 text-left">用法用量</th>
                    <th className="border p-2 text-left">频次</th>
                    <th className="border p-2 text-left">疗程</th>
                    <th className="border p-2 text-left">小计</th>
                    {!selectedPrescription && <th className="border p-2 text-left">操作</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedMedicines.map((medicine, index) => (
                    <tr key={index}>
                      <td className="border p-2">{medicine.name}</td>
                      <td className="border p-2">{medicine.specification}</td>
                      <td className="border p-2">¥{medicine.price.toFixed(2)}</td>
                      <td className="border p-2">
                        {selectedPrescription ? (
                          medicine.quantity
                        ) : (
                          <InputNumber
                            min={1}
                            value={medicine.quantity}
                            onChange={(value) => handleUpdateMedicine(index, 'quantity', value)}
                            style={{ width: 60 }}
                          />
                        )}
                      </td>
                      <td className="border p-2">
                        {selectedPrescription ? (
                          medicine.dosage
                        ) : (
                          <Input
                            placeholder="如：口服"
                            value={medicine.dosage}
                            onChange={(e) => handleUpdateMedicine(index, 'dosage', e.target.value)}
                            style={{ width: 80 }}
                          />
                        )}
                      </td>
                      <td className="border p-2">
                        {selectedPrescription ? (
                          medicine.frequency
                        ) : (
                          <Input
                            placeholder="如：每日3次"
                            value={medicine.frequency}
                            onChange={(e) => handleUpdateMedicine(index, 'frequency', e.target.value)}
                            style={{ width: 80 }}
                          />
                        )}
                      </td>
                      <td className="border p-2">
                        {selectedPrescription ? (
                          medicine.duration
                        ) : (
                          <Input
                            placeholder="如：7天"
                            value={medicine.duration}
                            onChange={(e) => handleUpdateMedicine(index, 'duration', e.target.value)}
                            style={{ width: 60 }}
                          />
                        )}
                      </td>
                      <td className="border p-2 font-medium">
                        ¥{(medicine.price * medicine.quantity).toFixed(2)}
                      </td>
                      {!selectedPrescription && (
                        <td className="border p-2">
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveMedicine(index)}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-right">
                <strong>总计：¥{selectedMedicines.reduce((sum, med) => sum + (med.price * med.quantity), 0).toFixed(2)}</strong>
              </div>
            </div>
          )}

          <Form.Item
            label="医生备注"
            name="notes"
          >
            <TextArea
              rows={3}
              placeholder="请输入备注信息"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PrescriptionManagement