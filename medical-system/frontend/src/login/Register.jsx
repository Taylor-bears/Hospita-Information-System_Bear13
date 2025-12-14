import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Radio, Alert, message } from 'antd';
import { UserOutlined, LockOutlined, MedicineBoxOutlined, SmileOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const { Title } = Typography;

const Register = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState('user');

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await axios.post('/api/register', values);
            if (values.role === 'doctor') {
                message.success('注册申请已提交，请等待管理员审核');
            } else {
                message.success('注册成功，请登录');
            }
            navigate('/login');
        } catch (error) {
            if (error.response) {
                message.error(error.response.data.detail || '注册失败');
            } else {
                message.error('网络错误，请稍后重试');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="auth-card register-card fade-in-up">
                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <div className="auth-heading">账户注册</div>
                    <div className="auth-sub">加入医疗综合服务系统</div>
                </div>

                <Form
                    name="register"
                    onFinish={onFinish}
                    initialValues={{ role: 'user' }}
                    size="large"
                    layout="vertical"
                >
                    <Form.Item
                        name="phone"
                        label="手机号"
                        rules={[
                            { required: true, message: '请输入手机号!' },
                            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号!' }
                        ]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="请输入手机号" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="密码"
                        rules={[{ required: true, message: '请输入密码!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
                    </Form.Item>

                    <Form.Item name="role" label="注册身份">
                        <Radio.Group onChange={(e) => setRole(e.target.value)} buttonStyle="solid" style={{ width: '100%' }}>
                            <Radio.Button value="user" style={{ width: '50%', textAlign: 'center' }}>
                                <SmileOutlined /> 普通用户
                            </Radio.Button>
                            <Radio.Button value="doctor" style={{ width: '50%', textAlign: 'center' }}>
                                <MedicineBoxOutlined /> 医生
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <div style={{ minHeight: '80px' }}>
                        {role === 'doctor' ? (
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Alert
                                    message="医生账号说明"
                                    description="注册为医生后，您的账号申请将将交由管理员审核，审核通过后方可登录"
                                    type="warning"
                                    showIcon
                                    style={{ fontSize: '12px' }}
                                />
                            </Form.Item>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '12px' }}>
                                普通用户注册后可直接登录使用
                            </div>
                        )}
                    </div>

                    <Form.Item style={{ marginTop: 24 }}>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            注册
                        </Button>
                        <div className="auth-aux">
                            已有账号？ <Link to="/login">去登录</Link>
                        </div>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default Register;
