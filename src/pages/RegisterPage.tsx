import React from 'react'
import { Card, Form, Input, Button, Select, message, Row, Col } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined, UserAddOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const { Option } = Select

type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist'

interface RegisterForm {
  phone: string
  password: string
  confirmPassword: string
  name: string
  role: UserRole
}

export default function RegisterPage() {
  const [form] = Form.useForm<RegisterForm>()
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (values: RegisterForm) => {
    try {
      await register({
        phone: values.phone,
        password: values.password,
        name: values.name,
        role: values.role
      })
      
      message.success('注册成功！请等待管理员审核（医生和药房工作人员需要审核）')
      
      // 根据角色跳转到登录页面或对应页面
      if (values.role === 'patient' || values.role === 'admin') {
        // 患者和管理员可以直接登录
        navigate('/login')
      } else {
        // 医生和药房工作人员需要审核
        message.info('您的账号正在审核中，审核通过后即可登录')
        navigate('/login')
      }
    } catch (error: any) {
      message.error(error.message || '注册失败')
    }
  }

  const validatePassword = (_: any, value: string) => {
    const password = form.getFieldValue('password')
    if (value && value !== password) {
      return Promise.reject(new Error('两次输入的密码不一致'))
    }
    return Promise.resolve()
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
              欢迎注册
            </h1>
            <p style={{ fontSize: '18px', marginBottom: '32px', opacity: 0.9 }}>
              加入我们，享受智能化医疗服务
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '12px', 
              padding: '24px',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ marginBottom: '16px' }}>注册须知</h3>
              <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
                <li>患者：可直接注册使用</li>
                <li>医生：注册后需管理员审核</li>
                <li>药房工作人员：注册后需管理员审核</li>
                <li>管理员：系统自动创建</li>
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
                <h2 style={{ margin: 0, color: '#1890ff' }}>用户注册</h2>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
                  创建您的账户
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
                name="name"
                label="姓名"
                rules={[
                  { required: true, message: '请输入姓名' },
                  { min: 2, message: '姓名至少2个字符' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="请输入姓名"
                />
              </Form.Item>

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
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  { validator: validatePassword }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="请再次输入密码"
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
                  注册
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#666' }}>已有账号？</span>
                <Link to="/login" style={{ marginLeft: '8px' }}>
                  立即登录
                </Link>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
