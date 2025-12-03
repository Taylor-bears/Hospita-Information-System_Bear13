import React, { useState } from 'react'
import { Card, Form, Input, Button, Row, Col, Avatar, Upload, message, Tabs, Descriptions, Tag } from 'antd'
import { UserOutlined, PhoneOutlined, HomeOutlined, UploadOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

const { TabPane } = Tabs

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuthStore()
  const [basicForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // 初始化表单数据
  React.useEffect(() => {
    if (user) {
      basicForm.setFieldsValue({
        name: user.name,
        phone: user.phone,
        address: user.address,
        avatar_url: user.avatar_url
      })
    }
  }, [user, basicForm])

  // 更新基本信息
  const handleBasicInfoSubmit = async (values: any) => {
    if (!user) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: values.name,
          phone: values.phone,
          address: values.address,
          avatar_url: values.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      // 更新本地存储
      updateUser({
        ...user,
        name: values.name,
        phone: values.phone,
        address: values.address,
        avatar_url: values.avatar_url
      })

      message.success('基本信息更新成功')
    } catch (error) {
      message.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  // 修改密码
  const handlePasswordSubmit = async (values: any) => {
    if (!user) return

    setLoading(true)
    try {
      // 验证原密码
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.phone,
        password: values.currentPassword
      })

      if (signInError) {
        message.error('原密码错误')
        return
      }

      // 更新密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.newPassword
      })

      if (updateError) throw updateError

      passwordForm.resetFields()
      message.success('密码修改成功')
    } catch (error) {
      message.error('密码修改失败')
    } finally {
      setLoading(false)
    }
  }

  // 头像上传
  const handleAvatarUpload = async (file: File) => {
    try {
      const fileName = `avatars/${user?.id}/${Date.now()}_${file.name}`
      
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // 获取公开URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      basicForm.setFieldsValue({ avatar_url: publicUrl })
      message.success('头像上传成功')
      return false // 阻止自动上传
    } catch (error) {
      message.error('头像上传失败')
      return false
    }
  }

  if (!user) {
    return <div>请先登录</div>
  }

  return (
    <div className="p-6">
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>个人资料</h2>
      <Row gutter={24}>
        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey="basic">
              <TabPane tab="基本信息" key="basic">
                <Form
                  form={basicForm}
                  layout="vertical"
                  onFinish={handleBasicInfoSubmit}
                  initialValues={{
                    name: user.name,
                    phone: user.phone,
                    address: user.address,
                    avatar_url: user.avatar_url
                  }}
                >
                  <Row gutter={24}>
                    <Col span={8}>
                      <Form.Item label="头像">
                        <Upload
                          name="avatar"
                          listType="picture-card"
                          className="avatar-uploader"
                          showUploadList={false}
                          beforeUpload={handleAvatarUpload}
                          accept="image/*"
                        >
                          {basicForm.getFieldValue('avatar_url') ? (
                            <img 
                              src={basicForm.getFieldValue('avatar_url')} 
                              alt="avatar" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div>
                              <UploadOutlined />
                              <div style={{ marginTop: 8 }}>上传头像</div>
                            </div>
                          )}
                        </Upload>
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Row gutter={24}>
                        <Col span={12}>
                          <Form.Item
                            name="name"
                            label="姓名"
                            rules={[{ required: true, message: '请输入姓名' }]}
                          >
                            <Input prefix={<UserOutlined />} placeholder="请输入姓名" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="phone"
                            label="手机号"
                            rules={[
                              { required: true, message: '请输入手机号' },
                              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
                            ]}
                          >
                            <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={24}>
                    
                        <Col span={12}>
                          <Form.Item
                            name="address"
                            label="地址"
                          >
                            <Input prefix={<HomeOutlined />} placeholder="请输入地址" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      保存修改
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>

              

              {user.role === 'doctor' && (
                <TabPane tab="医生信息" key="doctor">
                  <Card title="专业信息" style={{ marginBottom: 24 }}>
                    <Descriptions column={2}>
                      <Descriptions.Item label="专业">{user.specialty}</Descriptions.Item>
                      <Descriptions.Item label="职称">{user.title}</Descriptions.Item>
                      <Descriptions.Item label="执业证书">{user.license_number}</Descriptions.Item>
                      <Descriptions.Item label="所属医院">{user.hospital}</Descriptions.Item>
                      <Descriptions.Item label="科室">{user.department}</Descriptions.Item>
                      <Descriptions.Item label="工作经验">{user.experience_years} 年</Descriptions.Item>
                    </Descriptions>
                    {user.bio && (
                      <Descriptions column={1} style={{ marginTop: 16 }}>
                        <Descriptions.Item label="个人简介">{user.bio}</Descriptions.Item>
                      </Descriptions>
                    )}
                  </Card>
                </TabPane>
              )}

              <TabPane tab="操作日志" key="logs">
                <Card title="最近操作" style={{ marginBottom: 24 }}>
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    暂无操作日志
                  </div>
                </Card>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ProfilePage
