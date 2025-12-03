import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy } from 'react'

// 认证页面
const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))

// 患者页面
const PatientDashboard = lazy(() => import('../pages/patient/PatientDashboard'))
const AppointmentBooking = lazy(() => import('../pages/patient/AppointmentBooking'))
const AIConsult = lazy(() => import('../pages/patient/AIConsult'))
const MyOrders = lazy(() => import('../pages/patient/MyOrders'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))

// 医生页面
const DoctorDashboard = lazy(() => import('../pages/doctor/DoctorDashboard'))
const AppointmentManagement = lazy(() => import('../pages/doctor/AppointmentManagement'))
const PrescriptionManagement = lazy(() => import('../pages/doctor/PrescriptionManagement'))

// 管理员页面
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const UserReview = lazy(() => import('../pages/admin/UserReview'))
// 移除不存在的管理员页面以避免构建错误

// 药房页面
const PharmacyDashboard = lazy(() => import('../pages/pharmacy/PharmacyDashboard'))
const DrugInventory = lazy(() => import('../pages/pharmacy/DrugInventory'))
const PriceAdjustment = lazy(() => import('../pages/pharmacy/PriceAdjustment'))

// 布局组件
const AppLayout = lazy(() => import('../components/Layout/AppLayout'))

// 路由守卫组件
import ProtectedRoute from '../components/Auth/ProtectedRoute'

export default function AppRouter() {
  return (
    <Routes>
      {/* 认证路由 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* 患者路由 */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AppLayout>
              <PatientDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/appointment"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AppLayout>
              <AppointmentBooking />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/ai-consult"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AppLayout>
              <AIConsult />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/orders"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AppLayout>
              <MyOrders />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/profile"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      
      {/* 医生路由 */}
      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <AppLayout>
              <DoctorDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/appointments"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <AppLayout>
              <AppointmentManagement />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/prescriptions"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <AppLayout>
              <PrescriptionManagement />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* 移除不存在的医生“患者记录”路由 */}
      
      {/* 管理员路由 */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AppLayout>
              <UserReview />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* 移除不存在的管理员“排班管理/账号管理”路由 */}
      
      {/* 药房路由 */}
      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <AppLayout>
              <PharmacyDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/inventory"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <AppLayout>
              <DrugInventory />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/prices"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <AppLayout>
              <PriceAdjustment />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      
      {/* 默认路由 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
