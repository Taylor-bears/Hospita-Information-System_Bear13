import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const { Title } = Typography;

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const response = await axios.post('/api/login', values);
            message.success('登录成功');
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('user', JSON.stringify({
                role: response.data.role,
                status: response.data.status
            }));

            // 根据角色跳转到不同页面
            if (response.data.role === 'admin') {
                navigate('/admin');
            } else if (response.data.role === 'doctor') {
                navigate('/doctor');
            } else {
                navigate('/user');
            }
        } catch (error) {
            if (error.response) {
                message.error(error.response.data.detail || '登录失败');
            } else {
                message.error('网络错误，请稍后重试');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="auth-card fade-in-up">
                <div style={{ marginBottom: 24 }}>
                    <div className="auth-heading">医疗综合服务系统</div>
                    <div className="auth-sub">欢迎各位患者、医生登录</div>
                </div>

                <Form
                    name="normal_login"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    size="large"
                >
                    <Form.Item
                        name="phone"
                        rules={[{ required: true, message: '请输入手机号!' }, { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号!' }]}
                    >
                        <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="手机号" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码!' }]}
                    >
                        <Input.Password prefix={<LockOutlined className="site-form-item-icon" />} placeholder="密码" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            登录
                        </Button>
                        <div className="auth-aux">
                            没有账号？ <Link to="/register">立即注册</Link>
                        </div>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default Login;
