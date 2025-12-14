import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Descriptions, message, Popconfirm } from 'antd'
import { EyeOutlined, MedicineBoxOutlined, PayCircleOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

interface PrescriptionItem {
    id: number
    medication_name: string
    specification: string
    unit: string
    quantity: number
    price_at_time: number
    usage_instruction: string
}

interface Prescription {
    id: number
    status: string
    total_price: number
    created_at: string
    items: PrescriptionItem[]
    doctor_name?: string
    diagnosis?: string
}

const PatientPrescriptions: React.FC = () => {
    const { user } = useAuthStore()
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
    const [modalVisible, setModalVisible] = useState(false)

    const fetchPrescriptions = async () => {
        if (!user?.id) return
        setLoading(true)
        try {
            const res = await api.get('/api/pharmacy/prescriptions', {
                params: { patient_id: user.id }
            })
            setPrescriptions(res.data || [])
        } catch (error) {
            message.error('获取处方列表失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPrescriptions()
    }, [user?.id])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'orange'
            case 'paid': return 'blue'
            case 'dispensed': return 'green'
            case 'cancelled': return 'red'
            default: return 'default'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return '待支付/待发药'
            case 'paid': return '已支付'
            case 'dispensed': return '已发药'
            case 'cancelled': return '已取消'
            default: return status
        }
    }

    const handlePay = async (id: number) => {
        if (!user?.id) return
        try {
            await api.post(`/api/profile/pay/${id}`, null, { params: { user_id: user.id } })
            message.success('支付成功')
            fetchPrescriptions()
            setModalVisible(false)
        } catch (error) {
            message.error('支付失败')
        }
    }

    const columns = [
        {
            title: '处方编号',
            dataIndex: 'id',
            key: 'id',
            render: (id: number) => `#${id}`
        },
        {
            title: '药品摘要',
            key: 'summary',
            render: (record: Prescription) => (
                <span>
                    {record.items.map(i => i.medication_name).join(', ')}
                    {record.items.length > 2 ? '...' : ''}
                </span>
            )
        },
        {
            title: '总金额',
            dataIndex: 'total_price',
            key: 'total_price',
            render: (price: number) => `¥${(price).toFixed(2)}`
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
            title: '开具时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
        },
        {
            title: '操作',
            key: 'action',
            render: (record: Prescription) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => {
                            setSelectedPrescription(record)
                            setModalVisible(true)
                        }}
                    >
                        详情
                    </Button>
                    {record.status === 'pending' && (
                        <Popconfirm
                            title="确认支付"
                            description={`确认支付 ¥${record.total_price.toFixed(2)} 吗？`}
                            onConfirm={() => handlePay(record.id)}
                            okText="支付"
                            cancelText="取消"
                        >
                            <Button type="link" icon={<PayCircleOutlined />}>
                                支付
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ]

    return (
        <div className="p-6" >
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">我的药单</h1>
                <p className="text-gray-600">查看您的处方记录</p>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={prescriptions}
                    loading={loading}
                    rowKey="id"
                />
            </Card>

            <Modal
                title="处方详情"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    selectedPrescription?.status === 'pending' && (
                        <Popconfirm
                            key="pay"
                            title="确认支付"
                            description={`确认支付 ¥${selectedPrescription.total_price.toFixed(2)} 吗？`}
                            onConfirm={() => handlePay(selectedPrescription.id)}
                            okText="支付"
                            cancelText="取消"
                        >
                            <Button type="primary" icon={<PayCircleOutlined />}>
                                立即支付
                            </Button>
                        </Popconfirm>
                    ),
                    <Button key="close" onClick={() => setModalVisible(false)}>
                        关闭
                    </Button>
                ]}
                width={700}
            >
                {selectedPrescription && (
                    <div>
                        <Descriptions bordered column={2} className="mb-4">
                            <Descriptions.Item label="处方编号">#{selectedPrescription.id}</Descriptions.Item>
                            <Descriptions.Item label="医生">{selectedPrescription.doctor_name || '医生'}</Descriptions.Item>
                            <Descriptions.Item label="开具时间">
                                {dayjs(selectedPrescription.created_at).format('YYYY-MM-DD HH:mm')}
                            </Descriptions.Item>
                            <Descriptions.Item label="总金额">
                                <span className="text-red-600 font-bold">¥{selectedPrescription.total_price.toFixed(2)}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={getStatusColor(selectedPrescription.status)}>
                                    {getStatusText(selectedPrescription.status)}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        <Table
                            dataSource={selectedPrescription.items}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            columns={[
                                { title: '药品名称', dataIndex: 'medication_name' },
                                { title: '规格', dataIndex: 'specification' },
                                { title: '单价', dataIndex: 'price_at_time', render: (p) => `¥${p}` },
                                { title: '数量', dataIndex: 'quantity', render: (q, r) => `${q} ${r.unit || ''}` },
                                { title: '用法用量', dataIndex: 'usage_instruction' },
                                { title: '小计', render: (_, r) => `¥${(r.price_at_time * r.quantity).toFixed(2)}` }
                            ]}
                        />
                    </div>
                )}
            </Modal>
        </div >
    )
}

export default PatientPrescriptions
