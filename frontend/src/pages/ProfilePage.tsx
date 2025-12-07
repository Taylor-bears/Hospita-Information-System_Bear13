import React from 'react'
import { Card, Descriptions, Tag, Result } from 'antd'
import { useAuthStore } from '../stores/authStore'

// 简化个人资料卡：展示后端档案/登录信息，避免依赖外部 Supabase
export default function ProfilePage() {
  const { user } = useAuthStore()

  if (!user) {
    return <Result status="warning" title="请先登录后查看个人资料" />
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="个人资料">
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="姓名">{user.name || user.phone}</Descriptions.Item>
          <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color="blue">{user.role}</Tag>
          </Descriptions.Item>
          {user.department && (
            <Descriptions.Item label="科室">{user.department}</Descriptions.Item>
          )}
          {user.title && (
            <Descriptions.Item label="职称">{user.title}</Descriptions.Item>
          )}
          {user.license_number && (
            <Descriptions.Item label="执业证号">{user.license_number}</Descriptions.Item>
          )}
          {user.hospital && (
            <Descriptions.Item label="医院">{user.hospital}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </div>
  )
}
