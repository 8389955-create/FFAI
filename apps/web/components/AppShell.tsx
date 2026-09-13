'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type Principal } from '@/lib/api';

type MenuItem = { code: string; name: string; path: string | null };
const icons: Record<string, string> = { dashboard: '⌂', 'crm-customers': '客', 'crm-leads': '索', projects: '案', 'pim-products': '品', 'commercial-quotations': '价', 'oms-orders': '单', 'scm-purchasing': '采', 'mes-production': '产', 'wms-inventory': '仓', 'finance-center': '财', 'fulfillment-center': '履', 'task-alert-center': '警', 'analytics-center': '智', 'integration-center': '联', users: '人', roles: '钥', org: '组', dictionary: '典', audit: '审' };

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const pathname = usePathname(); const router = useRouter();
  const [user, setUser] = useState<Principal | null>(null);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  useEffect(() => {
    Promise.all([api<Principal & { roles?: unknown }>('/me'), api<MenuItem[]>('/me/menus')])
      .then(([profile, allowedMenus]) => { setUser(profile); setMenus(allowedMenus.filter((menu) => Boolean(menu.path))); if (profile.mustChangePassword && pathname !== '/account') router.replace('/account?password=required'); })
      .catch(() => router.replace('/login'));
  }, [pathname, router]);
  async function logout() { await api('/auth/logout', { method: 'POST' }).catch(() => null); sessionStorage.removeItem('ffai_access_token'); router.replace('/login'); }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">FF</div><div><strong>家具工厂 AI 系统</strong><span>FFAI · V1.0</span></div></div>
      <div className="nav-label">SPRINT 0 · 系统底座</div>
      <nav><Link className={pathname === '/dashboard' ? 'active' : ''} href="/dashboard"><i>⌂</i>经营总览</Link>{menus.filter((menu) => menu.path !== '/dashboard').map((menu) => <Link className={pathname === menu.path ? 'active' : ''} href={menu.path!} key={menu.code}><i>{icons[menu.code] ?? '·'}</i>{menu.name}</Link>)}</nav>
      <div className="side-footer"><span className="status-dot" />API / PostgreSQL 基础层</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="account"><div className="avatar">{user?.displayName?.slice(0, 1) ?? '…'}</div><Link href="/account"><strong>{user?.displayName ?? '正在验证'}</strong><span>{user?.roleCodes?.join(' · ')}</span></Link><button onClick={logout}>退出</button></div></header>
      <section className="content">{user?.mustChangePassword && <div className="password-notice">此账号使用临时密码，请先前往账号中心修改密码。</div>}{children}</section>
    </main>
  </div>;
}
