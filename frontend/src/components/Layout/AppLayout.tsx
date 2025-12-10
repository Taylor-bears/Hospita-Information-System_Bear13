import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import { 
  UserOutlined, 
  CalendarOutlined, 
  MedicineBoxOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  RobotOutlined,
  FileTextOutlined,
  TeamOutlined,
  ScheduleOutlined,
  UserSwitchOutlined,
  DatabaseOutlined,
  DollarOutlined
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout

interface AppLayoutProps {
  children?: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const getRoleDisplayName = (role?: string) => {
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
        return '用户'
    }
  }

  const getMenuItems = () => {
    switch (user?.role) {
      case 'patient':
        return [
          {
            key: '/patient',
            icon: <DashboardOutlined />,
            label: '首页',
            onClick: () => navigate('/patient')
          },
          {
            key: '/patient/appointment',
            icon: <CalendarOutlined />,
            label: '预约医生',
            onClick: () => navigate('/patient/appointment')
          },
          {
            key: '/patient/ai-consult',
            icon: <RobotOutlined />,
            label: 'AI问诊',
            onClick: () => navigate('/patient/ai-consult')
          },
          {
            key: '/patient/orders',
            icon: <MedicineBoxOutlined />,
            label: '我的药单',
            onClick: () => navigate('/patient/orders')
          },
          {
            key: '/patient/profile',
            icon: <UserOutlined />,
            label: '个人资料',
            onClick: () => navigate('/patient/profile')
          }
        ]
      case 'doctor':
        return [
          {
            key: '/doctor',
            icon: <DashboardOutlined />,
            label: '工作台',
            onClick: () => navigate('/doctor')
          },
          {
            key: '/doctor/appointments',
            icon: <CalendarOutlined />,
            label: '预约管理',
            onClick: () => navigate('/doctor/appointments')
          },
          {
            key: '/doctor/prescriptions',
            icon: <FileTextOutlined />,
            label: '开具处方',
            onClick: () => navigate('/doctor/prescriptions')
          },
          {
            key: '/doctor/records',
            icon: <FileTextOutlined />,
            label: '病例管理',
            onClick: () => navigate('/doctor/records')
          },
        ]
      case 'admin':
        return [
          {
            key: '/admin',
            icon: <DashboardOutlined />,
            label: '控制台',
            onClick: () => navigate('/admin')
          },
          {
            key: '/admin/users',
            icon: <UserSwitchOutlined />,
            label: '用户审核',
            onClick: () => navigate('/admin/users')
          },
          // 移除不存在的“排班管理/账号管理”菜单项
        ]
      case 'pharmacist':
        return [
          {
            key: '/pharmacy',
            icon: <DashboardOutlined />,
            label: '药房管理',
            onClick: () => navigate('/pharmacy')
          },
          {
            key: '/pharmacy/inventory',
            icon: <DatabaseOutlined />,
            label: '药品库存',
            onClick: () => navigate('/pharmacy/inventory')
          },
          {
            key: '/pharmacy/prices',
            icon: <DollarOutlined />,
            label: '价格调整',
            onClick: () => navigate('/pharmacy/prices')
          }
        ]
      default:
        return []
    }
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => {
        switch (user?.role) {
          case 'patient':
            navigate('/patient/profile')
            break
          default:
            // 其他角色可以添加对应的个人资料页面
            break
        }
      }
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#fff',
          borderRight: '1px solid #f0f0f0'
        }}
      >
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          background: '#1890ff'
        }}>
          <h1 style={{ 
            color: 'white', 
            margin: 0, 
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            医院管理系统
          </h1>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          style={{ borderRight: 0 }}
        />
      </Sider>
      
      <Layout style={{ marginLeft: 240 }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
              {getRoleDisplayName(user?.role)}工作台
            </h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Space>
              <Avatar icon={<UserOutlined />} />
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                arrow
              >
                <Button type="text">
                  {user?.name}
                  <span style={{ marginLeft: '8px', color: '#999' }}>
                    ({getRoleDisplayName(user?.role)})
                  </span>
                </Button>
              </Dropdown>
            </Space>
          </div>
        </Header>
        
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 112px)'
          }}
        >
          {children || <Outlet />}
        </Content>
      </Layout>
    </Layout>
  )
}
