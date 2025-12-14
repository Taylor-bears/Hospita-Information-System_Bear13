import React, { useState, useEffect } from 'react'
import {
    Table, Card, Input, Select, Tag, Button, Modal, Descriptions, Tabs, List, Badge, Space
} from 'antd'
import {
    SearchOutlined, UserOutlined, MedicineBoxOutlined, ScheduleOutlined, FileTextOutlined
} from '@ant-design/icons'
import api from '../../lib/api'
import dayjs from 'dayjs'

const { Option } = Select
const { TabPane } = Tabs

export default function UserManagement() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState({ role: 'all', keyword: '' })

    const [detailVisible, setDetailVisible] = useState(false)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await api.get('/api/admin/all-users', { params: filters })
            setUsers(res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [filters])

    const handleViewDetails = async (userId: number) => {
        setDetailVisible(true)
        setDetailLoading(true)
        try {
            const res = await api.get(`/api/admin/users/${userId}/details`)
            setCurrentUser(res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setDetailLoading(false)
        }
    }

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
        },
        {
            title: '姓名',
            dataIndex: 'name',
            render: (text: string) => text || <span className="text-gray-400">未设置</span>
        },
        {
            title: '手机号',
            dataIndex: 'phone',
        },
        {
            title: '角色',
            dataIndex: 'role',
            render: (role: string) => {
                const map: any = {
                    admin: <Tag color="red">管理员</Tag>,
                    doctor: <Tag color="blue">医生</Tag>,
                    user: <Tag color="green">患者</Tag>,
                    pharmacist: <Tag color="purple">药师</Tag>
                }
                return map[role] || role
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: string) => (
                <Badge status={status === 'active' ? 'success' : 'warning'} text={status === 'active' ? '正常' : '待审核/停用'} />
            )
        },
        {
            title: '注册时间',
            dataIndex: 'created_at',
            render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm')
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Button type="link" size="small" onClick={() => handleViewDetails(record.id)}>
                    查看详情
                </Button>
            )
        }
    ]

    const renderPatientDetails = (details: any) => (
        <Tabs defaultActiveKey="1">
            <TabPane tab={<span><UserOutlined />基本信息</span>} key="1">
                <Descriptions bordered column={1}>
                    <Descriptions.Item label="姓名">{details.profile?.name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="身份证号">{details.profile?.id_card || '-'}</Descriptions.Item>
                    <Descriptions.Item label="邮箱">{details.profile?.email || '-'}</Descriptions.Item>
                </Descriptions>
            </TabPane>
            <TabPane tab={<span><ScheduleOutlined />挂号记录</span>} key="2">
                <Table
                    dataSource={details.appointments}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                        { title: '时间', dataIndex: 'date', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
                        { title: '医生', dataIndex: 'doctor_name' },
                        { title: '状态', dataIndex: 'status' }
                    ]}
                />
            </TabPane>
            <TabPane tab={<span><FileTextOutlined />处方记录</span>} key="3">
                <Table
                    dataSource={details.prescriptions}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                        { title: '时间', dataIndex: 'date', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
                        { title: '金额', dataIndex: 'total_price', render: (p: number) => `¥${p.toFixed(2)}` },
                        { title: '状态', dataIndex: 'status' }
                    ]}
                />
            </TabPane>
        </Tabs>
    )

    const renderDoctorDetails = (details: any) => (
        <Tabs defaultActiveKey="1">
            <TabPane tab={<span><UserOutlined />基本信息</span>} key="1">
                <Descriptions bordered column={1}>
                    <Descriptions.Item label="姓名">{details.profile?.name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="科室">{details.profile?.department || '-'}</Descriptions.Item>
                    <Descriptions.Item label="职称">{details.profile?.title || '-'}</Descriptions.Item>
                    <Descriptions.Item label="所属医院">{details.profile?.hospital || '-'}</Descriptions.Item>
                    <Descriptions.Item label="执业证号">{details.profile?.license_number || '-'}</Descriptions.Item>
                </Descriptions>
            </TabPane>
            <TabPane tab={<span><ScheduleOutlined />接诊记录</span>} key="2">
                <Table
                    dataSource={details.appointments}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                        { title: '时间', dataIndex: 'date', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
                        { title: '患者', dataIndex: 'patient_name' },
                        { title: '状态', dataIndex: 'status' }
                    ]}
                />
            </TabPane>
        </Tabs>
    )

    return (
        <div className="p-6">
            <Card title="用户全景管理" extra={
                <Space>
                    <Select
                        defaultValue="all"
                        style={{ width: 120 }}
                        onChange={val => setFilters({ ...filters, role: val })}
                    >
                        <Option value="all">全部角色</Option>
                        <Option value="user">患者</Option>
                        <Option value="doctor">医生</Option>
                        <Option value="pharmacist">药师</Option>
                        <Option value="admin">管理员</Option>
                    </Select>
                    <Input.Search
                        placeholder="搜索手机号"
                        onSearch={val => setFilters({ ...filters, keyword: val })}
                        style={{ width: 200 }}
                    />
                </Space>
            }>
                <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={loading}
                />
            </Card>

            <Modal
                title="用户详细档案"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={null}
                width={800}
            >
                {detailLoading || !currentUser ? (
                    <div className="text-center py-10">加载中...</div>
                ) : (
                    <div>
                        <div className="mb-6 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                            <div className="text-lg font-bold">{currentUser.base.phone}</div>
                            <Tag color="blue">{currentUser.base.role}</Tag>
                            <div className="text-gray-500 text-sm">注册于: {dayjs(currentUser.base.created_at).format('YYYY-MM-DD')}</div>
                        </div>

                        {currentUser.base.role === 'user' && renderPatientDetails(currentUser.details)}
                        {currentUser.base.role === 'doctor' && renderDoctorDetails(currentUser.details)}
                        {['admin', 'pharmacist'].includes(currentUser.base.role) && (
                            <div className="text-gray-500 text-center py-10">暂无更多详细信息</div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
