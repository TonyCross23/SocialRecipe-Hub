import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';

export function ProtectedRoute({ permission, children }: { permission: string; children?: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.permissions.includes(permission)) return <Navigate to="/dashboard" replace />;
  return children ?? <Outlet />;
}

export function PermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = useAuthStore((state) => state.user?.permissions.includes(permission));
  return allowed ? children : null;
}
