import React, { useState } from 'react'
import { Card, Form, Input, Button, Select, message, Row, Col } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const { Option } = Select

type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist'

interface LoginForm {
  phone: string
  password: string
  role: UserRole
}

export default function LoginPage() {
  const [form] = Form.useForm<LoginForm>()
  const { login, loading, user } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (values: LoginForm) => {
    try {
      await login(values.phone, values.password, values.role)
      message.success('登录成功')
      
      // 根据实际登录角色跳转到对应页面
      const role = user?.role || values.role
      switch (role) {
        case 'patient':
          navigate('/patient')
          break
        case 'doctor':
          navigate('/doctor')
          break
        case 'admin':
          navigate('/admin')
          break
        case 'pharmacist':
          navigate('/pharmacy')
          break
        default:
          navigate('/patient')
      }
    } catch (error: any) {
      message.error(error.message || '登录失败')
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Row justify="center" align="middle" style={{ width: '100%', maxWidth: '1200px' }}>
        <Col xs={24} sm={24} md={12}>
          <div style={{ 
            color: 'white', 
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            <h1 style={{ fontSize: '48px', marginBottom: '24px', fontWeight: 'bold' }}>
              医院管理系统
            </h1>
            <p style={{ fontSize: '18px', marginBottom: '32px', opacity: 0.9 }}>
              智能化医疗管理，提升就医体验
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '12px', 
              padding: '24px',
              backdropFilter: 'blur(10px)',
              textAlign: 'center'
            }}>
              <h3 style={{ marginBottom: '16px' }}>系统特色</h3>
              <ul style={{ textAlign: 'center', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                <li>多角色权限管理</li>
                <li>智能预约系统</li>
                <li>AI辅助问诊</li>
                <li>电子处方管理</li>
                <li>药品库存管理</li>
              </ul>
            </div>
          </div>
        </Col>
        
        <Col xs={24} sm={24} md={12}>
          <Card
            style={{
              maxWidth: '400px',
              margin: '0 auto',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
            title={
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ margin: 0, color: '#1890ff' }}>用户登录</h2>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
                  请输入您的登录信息
                </p>
              </div>
            }
          >
            <Form
              form={form}
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
            >
              <Form.Item
                name="phone"
                label="手机号"
                rules={[
                  { required: true, message: '请输入手机号' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
                ]}
              >
                <Input 
                  prefix={<PhoneOutlined />} 
                  placeholder="请输入手机号"
                  maxLength={11}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 5, message: '密码长度至少5位' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="请输入密码"
                />
              </Form.Item>

              <Form.Item
                name="role"
                label="用户角色"
                rules={[{ required: true, message: '请选择用户角色' }]}
                initialValue="patient"
              >
                <Select placeholder="请选择用户角色">
                  <Option value="patient">患者</Option>
                  <Option value="doctor">医生</Option>
                  <Option value="pharmacist">药房工作人员</Option>
                  <Option value="admin">管理员</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{ 
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none',
                    height: '45px'
                  }}
                >
                  登录
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#666' }}>还没有账号？</span>
                <Link to="/register" style={{ marginLeft: '8px' }}>
                  立即注册
                </Link>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
