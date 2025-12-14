import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Descriptions, message, Popconfirm, Radio } from 'antd'
import { EyeOutlined, MedicineBoxOutlined, CheckCircleOutlined } from '@ant-design/icons'
import api from '../../lib/api'
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
    patient_name?: string
    patient_phone?: string
    doctor_name?: string
    diagnosis?: string
}

const PrescriptionProcessing: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
    const [modalVisible, setModalVisible] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>('paid') // Default to 'paid' (Ready to Dispense)

    const fetchPrescriptions = async () => {
        setLoading(true)
        try {
            const params: any = {}
            if (statusFilter !== 'all') {
                params.status = statusFilter
            }
            const res = await api.get('/api/pharmacy/prescriptions', { params })
            setPrescriptions(res.data || [])
        } catch (error) {
            message.error('获取处方列表失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPrescriptions()
    }, [statusFilter])

    const handleDispense = async (id: number) => {
        try {
            await api.post(`/api/pharmacy/prescriptions/${id}/dispense`)
            message.success('发药成功')
            fetchPrescriptions()
            setModalVisible(false)
        } catch (error) {
            message.error('发药失败：库存不足或状态错误')
        }
    }

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
            case 'pending': return '待支付'
            case 'paid': return '待发药'
            case 'dispensed': return '已发药'
            case 'cancelled': return '已取消'
            default: return status
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
            title: '患者',
            key: 'patient',
            render: (record: Prescription) => (
                <span>{record.patient_name || '未知'} ({record.patient_phone || '-'})</span>
            )
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
                    {record.status === 'paid' && (
                        <Popconfirm
                            title="确认发药"
                            description="确认库存充足并执行发药操作吗？"
                            onConfirm={() => handleDispense(record.id)}
                            okText="发药"
                            cancelText="取消"
                        >
                            <Button type="link" icon={<CheckCircleOutlined />}>
                                发药
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ]

    return (
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold mb-2">处方配药</h1>
                    <p className="text-gray-600">处理已支付的处方并发药</p>
                </div>
                <Radio.Group
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    buttonStyle="solid"
                >
                    <Radio.Button value="paid">待发药</Radio.Button>
                    <Radio.Button value="pending">待支付</Radio.Button>
                    <Radio.Button value="completed">已完成</Radio.Button>
                    <Radio.Button value="all">全部</Radio.Button>
                </Radio.Group>
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
                title="处方详情与配药"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    selectedPrescription?.status === 'paid' && (
                        <Popconfirm
                            key="dispense"
                            title="确认发药"
                            description="确认库存充足并执行发药操作吗？"
                            onConfirm={() => handleDispense(selectedPrescription.id)}
                            okText="发药"
                            cancelText="取消"
                        >
                            <Button type="primary" icon={<CheckCircleOutlined />}>
                                确认发药
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
                            <Descriptions.Item label="患者">{selectedPrescription.patient_name} ({selectedPrescription.patient_phone})</Descriptions.Item>
                            <Descriptions.Item label="开具时间">
                                {dayjs(selectedPrescription.created_at).format('YYYY-MM-DD HH:mm')}
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
                                { title: '数量', dataIndex: 'quantity', render: (q, r) => `${q} ${r.unit || ''}` },
                                { title: '用法用量', dataIndex: 'usage_instruction' },
                            ]}
                        />
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default PrescriptionProcessing
