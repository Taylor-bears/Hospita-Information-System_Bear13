import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, Space, message, Card, Row, Col, Statistic, Tabs } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { logAudit } from '../../lib/audit'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

interface User {
  id: string
  name: string
  phone: string
  
  role: 'patient' | 'doctor' | 'pharmacist' | 'admin'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  rejection_reason?: string
  approval_notes?: string
  specialization?: string
  license_number?: string
  department?: string
  age?: number
  gender?: string
}

const UserReview: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | User['status']>('pending')
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'doctor' | 'pharmacist'>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        pageSize,
      }
      if (activeTab !== 'all') params.status = activeTab
      if (roleFilter !== 'all') params.role = roleFilter
      const res = await api.get('/api/admin/reviews/items', { params })
      const items = Array.isArray(res.data?.items) ? res.data.items : []
      setTotal(Number(res.data?.total || items.length || 0))
      const mapped: User[] = items.map((u: any): User => ({
        id: String(u.id),
        name: String(u.name || '未命名'),
        phone: String(u.phone || ''),
        role: (u.role || 'doctor') as User['role'],
        status: (u.status || 'pending') as User['status'],
        created_at: String(u.submittedAt || ''),
        updated_at: String(u.updatedAt || u.submittedAt || ''),
        specialization: u.payload?.specialization,
        license_number: u.payload?.license_number,
        department: u.payload?.department,
      }))
      const filtered = mapped.filter((u) => (
        (searchText ? (u.name?.toLowerCase().includes(searchText.toLowerCase()) || u.phone?.includes(searchText)) : true)
      ))
      setUsers(filtered)
    } catch (error) {
      setUsers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [activeTab, roleFilter, page, pageSize, searchText])

  const handleViewDetails = (user: User) => {
    setSelectedUser(user)
    form.setFieldsValue({
      status: user.status,
      approval_notes: user.approval_notes || '',
      rejection_reason: user.rejection_reason || ''
    })
    setModalVisible(true)
  }

  const handleApprove = async (userId: string) => {
    try {
      await api.post(`/api/admin/reviews/${userId}/approve`, { notes: '' })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'approved' } : u))
      if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, status: 'approved' })
      try { await logAudit('approve', 'review', { id: userId }) } catch {}
      message.success('审核通过')
    } catch (e: any) {
      message.error(e?.message || '审核通过失败')
    }
  }

  const handleReject = async (userId: string, reason: string) => {
    try {
      await api.post(`/api/admin/reviews/${userId}/reject`, { reason })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'rejected', rejection_reason: reason } : u))
      if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, status: 'rejected', rejection_reason: reason })
      try { await logAudit('reject', 'review', { id: userId, reason }) } catch {}
      message.success('已拒绝该用户')
    } catch (e: any) {
      message.error(e?.message || '拒绝失败')
    }
  }

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) return
    try {
      const res = await api.post('/api/admin/reviews/batch', { action: 'approve', ids: selectedRowKeys })
      const successIds: string[] = Array.isArray(res.data?.success) ? res.data.success : selectedRowKeys as string[]
      const failed = Array.isArray(res.data?.failed) ? res.data.failed : []
      setUsers(prev => prev.map(u => successIds.includes(u.id) ? { ...u, status: 'approved' } : u))
      setSelectedRowKeys([])
      if (failed.length) message.warning(`部分失败：${failed.length}`)
      else message.success('批量通过成功')
    } catch (e: any) {
      message.error(e?.message || '批量通过失败')
    }
  }

  const handleBatchReject = () => {
    if (selectedRowKeys.length === 0) return
    let reason = ''
    Modal.confirm({
      title: '批量拒绝',
      content: (
        <Input placeholder="请输入拒绝原因" onChange={(e) => { reason = e.target.value }} />
      ),
      onOk: async () => {
        if (!reason) { message.error('请输入拒绝原因'); return }
        try {
          const res = await api.post('/api/admin/reviews/batch', { action: 'reject', ids: selectedRowKeys, reason })
          const successIds: string[] = Array.isArray(res.data?.success) ? res.data.success : selectedRowKeys as string[]
          const failed = Array.isArray(res.data?.failed) ? res.data.failed : []
          setUsers(prev => prev.map(u => successIds.includes(u.id) ? { ...u, status: 'rejected', rejection_reason: reason } : u))
          setSelectedRowKeys([])
          if (failed.length) message.warning(`部分失败：${failed.length}`)
          else message.success('批量拒绝成功')
        } catch (e: any) {
          message.error(e?.message || '批量拒绝失败')
        }
      }
    })
  }

  const handleSubmitReview = async (values: any) => {
    if (!selectedUser) return

    try {
      if (values.status === 'rejected' && !values.rejection_reason) {
        message.error('请输入拒绝原因')
        return
      }
      if (values.status === 'approved') {
        await handleApprove(selectedUser.id)
      } else if (values.status === 'rejected') {
        await handleReject(selectedUser.id, values.rejection_reason || '')
      }
      setModalVisible(false)
  } catch (error) {
    console.error('更新用户状态失败:', error)
    message.error('更新用户状态失败')
  }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理员'
      case 'doctor':
        return '医生'
      case 'patient':
        return '患者'
      case 'pharmacist':
        return '药房工作人员'
      default:
        return role
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'orange'
      case 'approved':
        return 'green'
      case 'rejected':
        return 'red'
      default:
        return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待审核'
      case 'approved':
        return '已通过'
      case 'rejected':
        return '已拒绝'
      default:
        return status
    }
  }

  const filteredUsers = users

  const statistics = {
    total: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length
  }

  const columns = [
    {
      title: '用户信息',
      key: 'user',
      render: (record: User) => (
        <div>
          <div className="font-medium">{record.name}</div>
          <div className="text-gray-500 text-sm">{record.phone}</div>
          
        </div>
      )
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color="blue">{getRoleDisplayName(role)}</Tag>
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
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => (
        <span>{dayjs(text).format('MM月DD日 HH:mm')}</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (record: User) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            查看详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '拒绝用户',
                    content: '确定要拒绝这个用户吗？',
                    onOk: () => handleReject(record.id, '不符合要求')
                  })
                }}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">用户审核</h1>
        <p className="text-gray-600">管理系统用户注册申请</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={statistics.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={statistics.pending}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已通过"
              value={statistics.approved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已拒绝"
              value={statistics.rejected}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选器 */}
      <Card className="mb-6">
        <div className="flex gap-4 items-center mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">状态筛选</label>
            <Select
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'all' | User['status'])}
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="pending">待审核</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">角色筛选</label>
            <Select
              value={roleFilter}
              onChange={(v) => setRoleFilter(v as 'all' | 'doctor' | 'pharmacist')}
              style={{ width: 160 }}
            >
              <Option value="all">全部可审核角色</Option>
              <Option value="doctor">医生</Option>
              <Option value="pharmacist">药房工作人员</Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">搜索用户</label>
            <Input
              placeholder="输入姓名或手机号"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          </div>
        </div>
      </Card>

      {/* 用户列表 */}
      <Card extra={
        <Space>
          <Button disabled={selectedRowKeys.length === 0} onClick={handleBatchApprove} type="primary">批量通过</Button>
          <Button disabled={selectedRowKeys.length === 0} onClick={handleBatchReject} danger>批量拒绝</Button>
        </Space>
      }>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10','20','50','100'],
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys)
          }}
          locale={{ emptyText: '当前无用户' }}
        />
      </Card>

      {/* 用户详情模态框 */}
      <Modal
        title="用户详情"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedUser && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmitReview}
          >
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">姓名</label>
                  <div className="font-medium">{selectedUser.name}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">手机号</label>
                  <div className="font-medium">{selectedUser.phone}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">角色</label>
                  <div>
                    <Tag color="blue">{getRoleDisplayName(selectedUser.role)}</Tag>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">状态</label>
                  <div>
                    <Tag color={getStatusColor(selectedUser.status)}>
                      {getStatusText(selectedUser.status)}
                    </Tag>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">注册时间</label>
                  <div className="font-medium">{dayjs(selectedUser.created_at).format('YYYY年MM月DD日 HH:mm')}</div>
                </div>
                {selectedUser.age && (
                  <div>
                    <label className="text-sm text-gray-600">年龄</label>
                    <div className="font-medium">{selectedUser.age}岁</div>
                  </div>
                )}
                {selectedUser.gender && (
                  <div>
                    <label className="text-sm text-gray-600">性别</label>
                    <div className="font-medium">{selectedUser.gender}</div>
                  </div>
                )}
              </div>
            </div>

            {selectedUser.specialization && (
              <Form.Item label="专业领域">
                <Input value={selectedUser.specialization} disabled />
              </Form.Item>
            )}

            {selectedUser.license_number && (
              <Form.Item label="执业证书号">
                <Input value={selectedUser.license_number} disabled />
              </Form.Item>
            )}

            {selectedUser.department && (
              <Form.Item label="所属科室">
                <Input value={selectedUser.department} disabled />
              </Form.Item>
            )}

            {selectedUser.rejection_reason && (
              <Form.Item label="拒绝原因">
                <TextArea value={selectedUser.rejection_reason} disabled rows={3} />
              </Form.Item>
            )}

            {selectedUser.approval_notes && (
              <Form.Item label="审核备注">
                <TextArea value={selectedUser.approval_notes} disabled rows={3} />
              </Form.Item>
            )}

            {selectedUser.status === 'pending' && (
              <>
                <Form.Item
                  label="审核状态"
                  name="status"
                  rules={[{ required: true, message: '请选择审核状态' }]}
                >
                  <Select placeholder="选择审核结果">
                    <Option value="approved">通过</Option>
                    <Option value="rejected">拒绝</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="拒绝原因"
                  name="rejection_reason"
                  dependencies={['status']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (getFieldValue('status') === 'rejected' && !value) {
                          return Promise.reject(new Error('请输入拒绝原因'))
                        }
                        return Promise.resolve()
                      }
                    })
                  ]}
                >
                  <TextArea 
                    rows={3} 
                    placeholder="请输入拒绝原因"
                    disabled={form.getFieldValue('status') !== 'rejected'}
                  />
                </Form.Item>

                <Form.Item
                  label="审核备注"
                  name="approval_notes"
                >
                  <TextArea rows={3} placeholder="请输入审核备注（可选）" />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      保存审核结果
                    </Button>
                    <Button onClick={() => setModalVisible(false)}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default UserReview
