'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) });
      const result = await response.json() as { accessToken?: string; message?: string };
      if (!response.ok || !result.accessToken) throw new Error(result.message ?? '登录失败');
      sessionStorage.setItem('ffai_access_token', result.accessToken); router.replace('/dashboard');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '登录失败'); } finally { setLoading(false); }
  }
  return <main className="login-page"><section className="login-story">
    <div className="story-top"><div className="brand-mark large">FF</div><span>Furniture Factory AI System</span></div>
    <div><p className="eyebrow">ONE DATA · EVERY ROLE · EVERY DEVICE</p><h1>让一件家具，从灵感到交付，<em>始终在同一条数据链上。</em></h1><p>统一账号、组织与权限底座，为 CRM、设计、供应链、生产、仓储、财务与客户协同提供可信的共同语言。</p></div>
    <div className="role-strip"><span>老板</span><span>设计师</span><span>工厂</span><span>经销商</span><span>客户</span></div>
  </section><section className="login-panel"><form onSubmit={submit}>
    <div className="mobile-brand"><div className="brand-mark">FF</div>家具工厂 AI 系统</div>
    <p className="eyebrow">WELCOME BACK</p><h2>登录工作台</h2><p className="muted">系统会根据您的角色自动加载权限与数据范围。</p>
    <label>企业代码<input name="organizationCode" defaultValue="FFAI_DEMO" autoComplete="organization" /></label>
    <label>用户名<input name="username" defaultValue="admin" autoComplete="username" /></label>
    <label>密码<input name="password" type="password" autoComplete="current-password" /></label>
    {error && <div className="error">{error}</div>}<button className="primary" disabled={loading}>{loading ? '正在登录…' : '进入系统 →'}</button>
    <small>演示账号由种子数据创建；首次上线前必须修改密码。</small>
  </form></section></main>;
}
