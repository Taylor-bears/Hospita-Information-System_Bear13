import React from 'react'
import { Card, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ maxWidth: 480 }} title="无权限访问">
        <p>您无权限访问该页面，请使用具有相应权限的账户登录。</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button type="primary" onClick={() => navigate('/login')}>返回登录</Button>
          <Button onClick={() => navigate('/')}>返回首页</Button>
        </div>
      </Card>
    </div>
  )
}

