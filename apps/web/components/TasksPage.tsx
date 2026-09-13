'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, type Principal } from '@/lib/api';
import { AppShell } from './AppShell';

type Person = { id: string; username: string; displayName: string };
type Task = { id: string; taskNo: string; title: string; description?: string; status: string; priority: string; dueAt?: string; sourceType?: string; sourceNo?: string; tags: string[]; assignee: Person; createdBy: { displayName: string } };
type Alert = { id: string; category: string; severity: string; status: string; title: string; description?: string; sourceType?: string; sourceNo?: string; dueAt?: string; detectedAt: string };
type Dashboard = { tasks: Record<string, number>; overdue: number; dueSoon: number; alerts: Record<string, number>; severities: Record<string, number> };
type Paged<T> = { items: T[]; total: number };

const taskStates: Record<string, string> = { TODO: '待处理', IN_PROGRESS: '进行中', DONE: '已完成', CANCELLED: '已取消' };
const alertStates: Record<string, string> = { OPEN: '待确认', ACKNOWLEDGED: '已确认', RESOLVED: '已解决', DISMISSED: '已忽略' };
const priorities: Record<string, string> = { LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' };
const emptyDashboard: Dashboard = { tasks: {}, overdue: 0, dueSoon: 0, alerts: {}, severities: {} };

export function TasksPage() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [tasks, setTasks] = useState<Paged<Task>>({ items: [], total: 0 });
  const [alerts, setAlerts] = useState<Paged<Alert>>({ items: [], total: 0 });
  const [assignees, setAssignees] = useState<Person[]>([]);
  const [me, setMe] = useState<Principal | null>(null);
  const [tab, setTab] = useState<'tasks' | 'alerts'>('tasks');
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [d, t, a, people, profile] = await Promise.all([
        api<Dashboard>('/tasks/dashboard'),
        api<Paged<Task>>(`/tasks?pageSize=100${status ? `&taskStatus=${status}` : ''}`),
        api<Paged<Alert>>('/tasks/alerts/list?pageSize=100').catch(() => ({ items: [], total: 0 })),
        api<Person[]>('/tasks/assignees'),
        api<Principal>('/me'),
      ]);
      setDashboard(d); setTasks(t); setAlerts(a); setAssignees(people); setMe(profile);
    } catch (e) { setError(e instanceof Error ? e.message : '读取任务预警失败'); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    try {
      await api('/tasks', { method: 'POST', body: JSON.stringify({ title: data.title, description: data.description || undefined, priority: data.priority, assigneeId: data.assigneeId, dueAt: data.dueAt ? new Date(String(data.dueAt)).toISOString() : undefined, reminderAt: data.reminderAt ? new Date(String(data.reminderAt)).toISOString() : undefined, sourceType: data.sourceType || undefined, sourceNo: data.sourceNo || undefined, tags: String(data.tags || '').split(',').map((x) => x.trim()).filter(Boolean) }) });
      setShowCreate(false); form.reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : '创建任务失败'); }
  }
  async function updateTask(item: Task, next: string) { try { await api(`/tasks/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : '更新任务失败'); } }
  async function scan() { try { await api('/tasks/alerts/scan', { method: 'POST' }); await load(); setTab('alerts'); } catch (e) { setError(e instanceof Error ? e.message : '预警扫描失败'); } }
  async function updateAlert(item: Alert, next: string) { try { await api(`/tasks/alerts/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : '更新预警失败'); } }
  const canCreate = me?.permissions.includes('task.create') ?? false;
  const canManage = me?.permissions.includes('task.manage') ?? false;
  const canScan = me?.permissions.includes('alert.scan') ?? false;
  const canManageAlerts = me?.permissions.includes('alert.manage') ?? false;

  return <AppShell title="任务与预警中心" subtitle="个人待办、跨部门协作和业务异常由统一状态机驱动，并保留来源单据链路。">
    <div className="crm-stats task-stats"><article><span>我的未完成</span><strong>{(dashboard.tasks.TODO ?? 0) + (dashboard.tasks.IN_PROGRESS ?? 0)}</strong></article><article><span>已超期任务</span><strong className={dashboard.overdue ? 'negative' : ''}>{dashboard.overdue}</strong></article><article><span>三日内到期</span><strong>{dashboard.dueSoon}</strong></article><article><span>活动预警</span><strong className={dashboard.severities.CRITICAL ? 'negative' : ''}>{(dashboard.alerts.OPEN ?? 0) + (dashboard.alerts.ACKNOWLEDGED ?? 0)}</strong></article></div>
    <div className="crm-toolbar"><div className="finance-tabs"><button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>任务</button><button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}>预警</button></div><div className="toolbar-actions">{tab === 'tasks' && <select className="finance-search" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部状态</option>{Object.entries(taskStates).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>}{tab === 'tasks' && canCreate && <button className="action" onClick={() => setShowCreate(true)}>＋ 新建任务</button>}{tab === 'alerts' && canScan && <button className="action" onClick={() => void scan()}>扫描业务异常</button>}</div></div>
    {error && <div className="error block">{error}</div>}
    {tab === 'tasks' && <div className="task-board">{tasks.items.map((item) => { const overdue = item.dueAt && new Date(item.dueAt).getTime() < Date.now() && !['DONE', 'CANCELLED'].includes(item.status); return <article key={item.id} className={overdue ? 'overdue' : ''}><header><span>{item.taskNo}</span><em className={`priority-${item.priority.toLowerCase()}`}>{priorities[item.priority]}</em></header><h3>{item.title}</h3><p>{item.description ?? '暂无补充说明'}</p><div className="task-meta"><span>执行人：{item.assignee.displayName}</span><span>{item.sourceNo ? `来源：${item.sourceNo}` : '独立任务'}</span><span className={overdue ? 'late' : ''}>{item.dueAt ? `${overdue ? '已超期 · ' : ''}${new Date(item.dueAt).toLocaleString('zh-CN')}` : '未设截止时间'}</span></div><footer><span className={`state ${item.status.toLowerCase()}`}>{taskStates[item.status]}</span>{canManage && <div className="inline-actions">{item.status === 'TODO' && <button onClick={() => void updateTask(item, 'IN_PROGRESS')}>开始</button>}{item.status === 'IN_PROGRESS' && <button onClick={() => void updateTask(item, 'DONE')}>完成</button>}{item.status === 'DONE' && <button onClick={() => void updateTask(item, 'IN_PROGRESS')}>重开</button>}</div>}</footer></article>; })}</div>}
    {tab === 'alerts' && <div className="alert-list">{alerts.items.map((item) => <article key={item.id} className={`severity-${item.severity.toLowerCase()}`}><i>{item.severity === 'CRITICAL' ? '!' : item.severity === 'WARNING' ? '△' : 'i'}</i><div><header><b>{item.title}</b><span className={`state ${item.status.toLowerCase()}`}>{alertStates[item.status]}</span></header><p>{item.description}</p><small>{item.category} · {item.sourceNo ?? '系统'} · 检测于 {new Date(item.detectedAt).toLocaleString('zh-CN')}</small></div>{canManageAlerts && item.status === 'OPEN' && <button onClick={() => void updateAlert(item, 'ACKNOWLEDGED')}>确认</button>}{canManageAlerts && item.status === 'ACKNOWLEDGED' && <button onClick={() => void updateAlert(item, 'RESOLVED')}>解决</button>}</article>)}</div>}
    {loading && <div className="empty">正在汇总任务和预警…</div>}
    {!loading && tab === 'tasks' && !tasks.total && <div className="empty">当前没有任务</div>}{!loading && tab === 'alerts' && !alerts.total && <div className="empty">当前没有业务预警</div>}
    {showCreate && <div className="drawer-mask" onMouseDown={() => setShowCreate(false)}><section className="drawer task-drawer" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setShowCreate(false)}>×</button><p className="eyebrow">WORK TASK</p><h2>新建协作任务</h2><form className="crm-form" onSubmit={createTask}><label>任务标题<input name="title" required /></label><label>任务说明<textarea name="description" rows={3} /></label><div><label>优先级<select name="priority" defaultValue="NORMAL"><option value="LOW">低</option><option value="NORMAL">普通</option><option value="HIGH">高</option><option value="URGENT">紧急</option></select></label><label>执行人<select name="assigneeId" required defaultValue=""><option value="">请选择</option>{assignees.map((item) => <option value={item.id} key={item.id}>{item.displayName} · {item.username}</option>)}</select></label></div><div><label>截止时间<input name="dueAt" type="datetime-local" /></label><label>提醒时间<input name="reminderAt" type="datetime-local" /></label></div><div><label>来源类型<input name="sourceType" placeholder="如 SALES_ORDER" /></label><label>来源编号<input name="sourceNo" placeholder="如 SO-20260913-0001" /></label></div><label>标签<input name="tags" placeholder="多个标签用逗号分隔" /></label><button className="primary">创建任务</button></form></section></div>}
  </AppShell>;
}
