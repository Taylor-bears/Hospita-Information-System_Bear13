import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Avatar, Dropdown, Space, Typography } from 'antd';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
    UserOutlined,
    CalendarOutlined,
    FileTextOutlined,
    MedicineBoxOutlined,
    StarOutlined,
    LogoutOutlined,
    BellOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            navigate('/login');
            return;
        }
        const userData = JSON.parse(userStr);
        if (userData.role !== 'admin') {
            navigate('/login');
            return;
        }
        setUser(userData);

        fetchPendingDoctors();
    }, [navigate]);

    const fetchPendingDoctors = async () => {
        try {
            const response = await axios.get('/api/admin/pending-doctors-count');
            setPendingCount(response.data.count || 0);
        } catch (error) {
            console.error('Failed to fetch pending count:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const userMenuItems = [
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            onClick: handleLogout,
        },
    ];

    const menuItems = [
        {
            key: '/admin/users',
            icon: <UserOutlined />,
            label: (
                <Space>
                    用户管理
                    {pendingCount > 0 && <Badge count={pendingCount} size="small" offset={[10, 0]} />}
                </Space>
            ),
        },
        {
            key: '/admin/appointments',
            icon: <CalendarOutlined />,
            label: '预约管理',
        },
        {
            key: '/admin/records',
            icon: <FileTextOutlined />,
            label: '病历管理',
        },
        {
            key: '/admin/pharmacy',
            icon: <MedicineBoxOutlined />,
            label: '药房管理',
        },
        {
            key: '/admin/reviews',
            icon: <StarOutlined />,
            label: '医生评价',
        },
    ];

    const handleMenuClick = ({ key }) => {
        navigate(key);
    };

    if (!user) return null;

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                style={{
                    background: 'linear-gradient(180deg, #001529 0%, #002140 100%)',
                    boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
                }}
                width={240}
            >
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: collapsed ? 16 : 20,
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    letterSpacing: '1px',
                }}>
                    {collapsed ? '医疗' : '医疗管理系统'}
                </div>
                <Menu
                    theme="dark"
                    selectedKeys={[location.pathname]}
                    mode="inline"
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ marginTop: 16, border: 'none' }}
                />
            </Sider>

            <Layout>
                <Header style={{
                    padding: '0 32px',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    zIndex: 1,
                }}>
                    <div>
                        <Text strong style={{ fontSize: 20, color: '#1a3353' }}>管理员控制台</Text>
                    </div>
                    <Space size={24}>
                        <Badge count={pendingCount} size="default">
                            <BellOutlined style={{ fontSize: 22, cursor: 'pointer', color: '#666' }} />
                        </Badge>
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <Space style={{ cursor: 'pointer' }}>
                                <Avatar icon={<UserOutlined />} style={{ background: '#1890ff' }} size={36} />
                                <Text style={{ fontSize: 15, fontWeight: 500 }}>管理员</Text>
                            </Space>
                        </Dropdown>
                    </Space>
                </Header>

                <Content style={{
                    margin: '24px',
                    minHeight: 280,
                }}>
                    <Outlet context={{ refreshPendingCount: fetchPendingDoctors }} />
                </Content>
            </Layout>
        </Layout>
    );
};

export default AdminLayout;
