import { useQuery } from '@tanstack/react-query';
import { Bell, Bot, ChartNoAxesCombined, FileWarning, Gauge, LogOut, Settings2, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Notification } from '../lib/types';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/auth-store';
import { PermissionGate } from './ProtectedRoute';
import { Button } from './ui';

const links = [
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileWarning, permission: 'moderation:review' },
  { to: '/audit-logs', label: 'AI audit logs', icon: Bot, permission: 'moderation:review' },
  { to: '/policies', label: 'Policies', icon: Settings2, permission: 'policy:manage' },
  { to: '/monitoring', label: 'Monitoring', icon: ChartNoAxesCombined },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user)!;
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ data: Notification[]; unreadCount: number }>('/admin/notifications?limit=10'), refetchInterval: 20_000 });
  const markRead = useMutation({ mutationFn: (id: string) => api(`/admin/notifications/${id}/read`, { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const markAllRead = useMutation({ mutationFn: () => api('/admin/notifications/read-all', { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const logout = async () => { try { await api('/auth/logout', { method: 'POST', body: '{}' }); } finally { clear(); navigate('/login'); } };
  return <div className="min-h-screen bg-stone-50 text-stone-900 lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="border-r border-stone-200 bg-[#123d31] p-5 text-white lg:min-h-screen">
      <div className="mb-10 flex items-center gap-3 text-lg font-bold"><span className="grid size-9 place-items-center rounded-xl rounded-bl-sm bg-lime-300 text-emerald-950">S</span>SocialRecipe</div>
      <nav className="grid gap-1">{links.map(({ to, label, icon: Icon, permission }) => {
        const item = <NavLink key={to} to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-50/70 hover:bg-white/10 hover:text-white', isActive && 'bg-white/15 text-white')}><Icon size={18} />{label}</NavLink>;
        return permission ? <PermissionGate key={to} permission={permission}>{item}</PermissionGate> : item;
      })}</nav>
      <div className="mt-10 border-t border-white/10 pt-5"><p className="font-semibold">{user.name}</p><p className="text-sm text-emerald-100/60">{user.role}</p><Button variant="ghost" className="mt-3 text-white hover:bg-white/10" onClick={logout}><LogOut size={16} />Sign out</Button></div>
    </aside>
    <main className="min-w-0"><header className="flex h-20 items-center justify-between border-b border-stone-200 bg-white px-5 lg:px-8"><div><p className="text-xs font-bold tracking-[.18em] text-emerald-700">COMMUNITY OPERATIONS</p><h1 className="text-xl font-bold">Admin workspace</h1></div><div className="relative"><button aria-label="Notifications" className="relative rounded-xl p-2 hover:bg-stone-100" onClick={() => setNotificationsOpen((open) => !open)}><Bell size={21} />{Boolean(notifications.data?.unreadCount) && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{notifications.data?.unreadCount}</span>}</button>{notificationsOpen && <div className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-stone-100 p-4"><strong>Notifications</strong><button className="text-xs font-semibold text-emerald-700" onClick={() => markAllRead.mutate()}>Mark all read</button></div><div className="max-h-96 overflow-y-auto">{notifications.data?.data.length ? notifications.data.data.map((item) => <button key={item.id} className={cn('block w-full border-b border-stone-100 p-4 text-left hover:bg-stone-50', !item.readAt && 'bg-emerald-50')} onClick={() => { markRead.mutate(item.id); setNotificationsOpen(false); navigate('/reports'); }}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-stone-500">{item.message}</span></button>) : <p className="p-5 text-center text-sm text-stone-500">You are all caught up.</p>}</div></div>}</div></header><div className="p-5 lg:p-8"><Outlet /></div></main>
  </div>;
}
