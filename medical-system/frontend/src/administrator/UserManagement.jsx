import React, { useState, useEffect } from 'react';
import {
    Card,
    Tabs,
    Table,
    Button,
    Space,
    Tag,
    Modal,
    Form,
    Input,
    Select,
    message,
    Popconfirm,
    Badge,
    Descriptions,
} from 'antd';
import {
    UserOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';

const { TabPane } = Tabs;

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [pendingDoctors, setPendingDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [currentReview, setCurrentReview] = useState(null);
    const [addForm] = Form.useForm();
    const { refreshPendingCount } = useOutletContext();

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchUsers(),
                fetchDoctors(),
                fetchAdmins(),
                fetchPendingDoctors(),
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/admin/users');
            setUsers(response.data);
        } catch (error) {
            message.error('获取用户列表失败');
        }
    };

    const fetchDoctors = async () => {
        try {
            const response = await axios.get('/api/admin/doctors');
            setDoctors(response.data);
        } catch (error) {
            message.error('获取医生列表失败');
        }
    };

    const fetchAdmins = async () => {
        try {
            const response = await axios.get('/api/admin/admins');
            setAdmins(response.data);
        } catch (error) {
            message.error('获取管理员列表失败');
        }
    };

    const fetchPendingDoctors = async () => {
        try {
            const response = await axios.get('/api/admin/pending-doctors');
            setPendingDoctors(response.data);
            refreshPendingCount();
        } catch (error) {
            message.error('获取待审核医生列表失败');
        }
    };

    const handleAddUser = async (values) => {
        try {
            await axios.post('/api/admin/add-user', values);
            message.success('添加成功');
            setAddModalVisible(false);
            addForm.resetFields();
            fetchAllData();
        } catch (error) {
            message.error(error.response?.data?.detail || '添加失败');
        }
    };

    const handleDeleteUser = async (userId) => {
        try {
            await axios.delete(`/api/admin/user/${userId}`);
            message.success('删除成功');
            fetchAllData();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleReview = (record) => {
        setCurrentReview(record);
        setReviewModalVisible(true);
    };

    const handleApprove = async () => {
        try {
            await axios.post(`/api/admin/approve-doctor/${currentReview.id}`);
            message.success('审核通过');
            setReviewModalVisible(false);
            fetchAllData();
        } catch (error) {
            message.error('审核失败');
        }
    };

    const handleReject = async () => {
        try {
            await axios.post(`/api/admin/reject-doctor/${currentReview.id}`);
            message.success('已拒绝');
            setReviewModalVisible(false);
            fetchAllData();
        } catch (error) {
            message.error('操作失败');
        }
    };

    const userColumns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            key: 'phone',
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (role) => (
                <Tag color={role === 'admin' ? 'red' : 'blue'}>
                    {role === 'admin' ? '管理员' : '普通用户'}
                </Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'active' ? 'green' : 'orange'}>
                    {status === 'active' ? '正常' : '待审核'}
                </Tag>
            ),
        },
        {
            title: '注册时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => new Date(time).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Popconfirm
                        title="确定删除此用户吗？"
                        onConfirm={() => handleDeleteUser(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const doctorColumns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            key: 'phone',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'active' ? 'green' : 'orange'}>
                    {status === 'active' ? '正常' : '待审核'}
                </Tag>
            ),
        },
        {
            title: '注册时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => new Date(time).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Popconfirm
                        title="确定删除此医生吗？"
                        onConfirm={() => handleDeleteUser(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const adminColumns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            key: 'phone',
        },
        {
            title: '注册时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => new Date(time).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Popconfirm
                        title="确定删除此管理员吗？删除后无法恢复！"
                        onConfirm={() => handleDeleteUser(record.id)}
                        okText="确定"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const pendingColumns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            key: 'phone',
        },
        {
            title: '申请时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => new Date(time).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button type="primary" onClick={() => handleReview(record)}>
                    审核
                </Button>
            ),
        },
    ];

    return (
        <div>
            <Card
                title={
                    <Space>
                        <UserOutlined />
                        <span style={{ fontSize: 18, fontWeight: 600 }}>用户管理</span>
                    </Space>
                }
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                        添加用户
                    </Button>
                }
                bordered={false}
                style={{ borderRadius: 8 }}
            >
                <Tabs defaultActiveKey="1">
                    <TabPane tab="普通用户" key="1">
                        <Table
                            columns={userColumns}
                            dataSource={users}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>

                    <TabPane tab="医生" key="2">
                        <Table
                            columns={doctorColumns}
                            dataSource={doctors}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>

                    <TabPane tab="管理员" key="3">
                        <Table
                            columns={adminColumns}
                            dataSource={admins}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>

                    <TabPane
                        tab={
                            <Badge count={pendingDoctors.length} offset={[10, 0]}>
                                <span>待审核医生</span>
                            </Badge>
                        }
                        key="4"
                    >
                        <Table
                            columns={pendingColumns}
                            dataSource={pendingDoctors}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                        />
                    </TabPane>
                </Tabs>
            </Card>

            {/* 添加用户Modal */}
            <Modal
                title="添加用户"
                open={addModalVisible}
                onCancel={() => {
                    setAddModalVisible(false);
                    addForm.resetFields();
                }}
                footer={null}
                width={500}
            >
                <Form
                    form={addForm}
                    layout="vertical"
                    onFinish={handleAddUser}
                >
                    <Form.Item
                        name="phone"
                        label="手机号"
                        rules={[
                            { required: true, message: '请输入手机号' },
                            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
                        ]}
                    >
                        <Input placeholder="请输入手机号" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="密码"
                        rules={[{ required: true, message: '请输入密码' }]}
                    >
                        <Input.Password placeholder="请输入密码" />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="角色"
                        rules={[{ required: true, message: '请选择角色' }]}
                    >
                        <Select placeholder="请选择角色">
                            <Select.Option value="user">普通用户</Select.Option>
                            <Select.Option value="doctor">医生</Select.Option>
                            <Select.Option value="admin">管理员</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => {
                                setAddModalVisible(false);
                                addForm.resetFields();
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                添加
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 审核Modal */}
            <Modal
                title={
                    <Space>
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        <span>医生注册审核</span>
                    </Space>
                }
                open={reviewModalVisible}
                onCancel={() => setReviewModalVisible(false)}
                footer={[
                    <Button key="reject" danger icon={<CloseOutlined />} onClick={handleReject}>
                        拒绝
                    </Button>,
                    <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={handleApprove}>
                        通过
                    </Button>,
                ]}
                width={600}
            >
                {currentReview && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="用户ID">{currentReview.id}</Descriptions.Item>
                        <Descriptions.Item label="手机号">{currentReview.phone}</Descriptions.Item>
                        <Descriptions.Item label="申请时间">
                            {new Date(currentReview.created_at).toLocaleString('zh-CN')}
                        </Descriptions.Item>
                        <Descriptions.Item label="当前状态">
                            <Tag color="orange">待审核</Tag>
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

export default UserManagement;
