import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ReportsPage } from './pages/ReportsPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute permission="admin:read" />}>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/reports" element={<ProtectedRoute permission="moderation:review"><ReportsPage /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute permission="moderation:review"><AuditLogsPage /></ProtectedRoute>} />
        <Route path="/policies" element={<ProtectedRoute permission="policy:manage"><PoliciesPage /></ProtectedRoute>} />
        <Route path="/monitoring" element={<MonitoringPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}
