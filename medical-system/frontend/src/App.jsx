import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './login/Login';
import Register from './login/Register';
import AdminLayout from './administrator/AdminLayout';
import UserManagement from './administrator/UserManagement';
import AppointmentManagement from './administrator/AppointmentManagement';
import RecordManagement from './administrator/RecordManagement';
import PharmacyManagement from './administrator/PharmacyManagement';
import ReviewManagement from './administrator/ReviewManagement';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/users" replace />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="appointments" element={<AppointmentManagement />} />
                    <Route path="records" element={<RecordManagement />} />
                    <Route path="pharmacy" element={<PharmacyManagement />} />
                    <Route path="reviews" element={<ReviewManagement />} />
                </Route>
                <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
