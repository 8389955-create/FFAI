'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Principal } from '@/lib/api';
import { AppShell } from './AppShell';

type Role = { id: string; code: string; name: string; active: boolean; dataScope: string };
type OrgUnit = { id: string; code: string; name: string; path: string; type: string; active: boolean };
type AssignedRole = Pick<Role, 'code' | 'name'> & Partial<Pick<Role, 'id' | 'active' | 'dataScope'>>;
type AssignedOrgUnit = Pick<OrgUnit, 'code' | 'name'> & Partial<Pick<OrgUnit, 'id' | 'path' | 'type' | 'active'>>;
type User = { id: string; username: string; employeeNo?: string; displayName: string; phone?: string; email?: string; jobTitle?: string; remark?: string; status: string; mustChangePassword: boolean; lastLoginAt?: string; createdAt: string; roles: { role: AssignedRole }[]; orgUnits: { isPrimary: boolean; orgUnit: AssignedOrgUnit }[] };
type Options = { roles: Role[]; orgUnits: OrgUnit[] };
type Form = { username: string; employeeNo: string; displayName: string; phone: string; email: string; jobTitle: string; remark: string; password: string; status: string; mustChangePassword: boolean; roleIds: string[]; orgUnitIds: string[]; primaryOrgUnitId: string };
const empty: Form = { username: '', employeeNo: '', displayName: '', phone: '', email: '', jobTitle: '', remark: '', password: '', status: 'ACTIVE', mustChangePassword: true, roleIds: [], orgUnitIds: [], primaryOrgUnitId: '' };
const statusLabels: Record<string,string> = { ACTIVE: '正常', DISABLED: '已停用', LOCKED: '已锁定', PENDING: '待启用' };

export function UsersPage() {
  const [principal, setPrincipal] = useState<Principal>(); const [items, setItems] = useState<User[]>([]); const [options, setOptions] = useState<Options>({ roles: [], orgUnits: [] });
  const [keyword, setKeyword] = useState(''); const [status, setStatus] = useState(''); const [roleId, setRoleId] = useState(''); const [selected, setSelected] = useState<User>(); const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(empty); const [resetPassword, setResetPassword] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(true);
  const canCreate = principal?.roleCodes.includes('OWNER') || principal?.permissions.includes('system.user.create');
  const canUpdate = principal?.roleCodes.includes('OWNER') || principal?.permissions.includes('system.user.update');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const search = new URLSearchParams({ pageSize: '100' }); if (keyword) search.set('keyword', keyword); if (status) search.set('status', status); if (roleId) search.set('roleId', roleId);
    try { const [me, result, access] = await Promise.all([api<Principal>('/me'), api<{items:User[]}>(`/system/users?${search}`), api<Options>('/system/access-options')]); setPrincipal(me); setItems(result.items); setOptions(access); }
    catch (e) { setError(e instanceof Error ? e.message : '读取用户失败'); } finally { setLoading(false); }
  }, [keyword, roleId, status]);
  useEffect(() => { void load(); }, [load]);
  const primaryUnit = useMemo(() => options.orgUnits.find((x) => x.id === form.primaryOrgUnitId), [options.orgUnits, form.primaryOrgUnitId]);
  function openCreate() { setSelected(undefined); setCreating(true); setResetPassword(''); setForm(empty); setError(''); setNotice(''); }
  function openEdit(user: User) {
    const roleIds = user.roles.map(({ role }) => role.id ?? options.roles.find((item) => item.code === role.code)?.id).filter((id): id is string => typeof id === 'string');
    const assignedUnits = user.orgUnits.map((membership) => ({ ...membership, id: membership.orgUnit.id ?? options.orgUnits.find((item) => item.code === membership.orgUnit.code)?.id }));
    const orgUnitIds = assignedUnits.map((membership) => membership.id).filter((id): id is string => typeof id === 'string');
    const primaryOrgUnitId = assignedUnits.find((membership) => membership.isPrimary)?.id ?? orgUnitIds[0] ?? '';
    setCreating(false); setSelected(user); setResetPassword(''); setForm({ username:user.username, employeeNo:user.employeeNo??'', displayName:user.displayName, phone:user.phone??'', email:user.email??'', jobTitle:user.jobTitle??'', remark:user.remark??'', password:'', status:user.status, mustChangePassword:user.mustChangePassword, roleIds, orgUnitIds, primaryOrgUnitId }); setError(''); setNotice('');
  }
  function close() { setCreating(false); setSelected(undefined); setError(''); setNotice(''); }
  function toggleRole(id:string) { setForm((x)=>({...x,roleIds:x.roleIds.includes(id)?x.roleIds.filter(v=>v!==id):[...x.roleIds,id]})); }
  function toggleUnit(id:string) { setForm((x)=>{ const checked=!x.orgUnitIds.includes(id); const orgUnitIds=checked?[...x.orgUnitIds,id]:x.orgUnitIds.filter(v=>v!==id); return {...x,orgUnitIds,primaryOrgUnitId:checked&&!x.primaryOrgUnitId?id:(!checked&&x.primaryOrgUnitId===id?(orgUnitIds[0]??''):x.primaryOrgUnitId)}; }); }
  async function save(event:FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    const roleIds = [...new Set(form.roleIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    const orgUnitIds = [...new Set(form.orgUnitIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (!roleIds.length || !orgUnitIds.length || !form.primaryOrgUnitId || !orgUnitIds.includes(form.primaryOrgUnitId)) { setError('请至少选择一个角色、一个组织并指定主组织'); return; }
    const base = { employeeNo:form.employeeNo, displayName:form.displayName, phone:form.phone, email:form.email, jobTitle:form.jobTitle, remark:form.remark, status:form.status, roleIds, orgUnitIds, primaryOrgUnitId:form.primaryOrgUnitId };
    try {
      if (creating) await api('/system/users',{method:'POST',body:JSON.stringify({...base,username:form.username,password:form.password,mustChangePassword:form.mustChangePassword})});
      else if (selected) await api(`/system/users/${selected.id}`,{method:'PATCH',body:JSON.stringify(base)});
      if (!creating && selected?.id === principal?.sub) {
        sessionStorage.removeItem('ffai_access_token');
        window.location.assign('/login');
        return;
      }
      setNotice(creating?'用户已创建':'用户资料与权限已更新，原会话已失效'); await load(); if (creating) close(); else if(selected) openEdit(await api<User>(`/system/users/${selected.id}`));
    } catch(e) { setError(e instanceof Error?e.message:'保存失败'); }
  }
  async function reset(event:FormEvent) { event.preventDefault(); if(!selected)return; setError(''); try { await api(`/system/users/${selected.id}/reset-password`,{method:'POST',body:JSON.stringify({newPassword:resetPassword,mustChangePassword:true})}); setResetPassword(''); setNotice('密码已重置，用户须在下次登录后修改；旧会话已全部失效'); } catch(e){setError(e instanceof Error?e.message:'重置失败');} }

  return <AppShell title="用户与账号" subtitle="统一维护账号资料、多角色、所属组织、账号状态与密码安全。">
    <div className="system-summary"><article><small>用户总数</small><b>{items.length}</b><span>当前筛选结果</span></article><article><small>正常账号</small><b>{items.filter(x=>x.status==='ACTIVE').length}</b><span>可登录使用</span></article><article><small>待改密码</small><b>{items.filter(x=>x.mustChangePassword).length}</b><span>临时密码账号</span></article><article><small>标准角色</small><b>{options.roles.length}</b><span>支持一人多角色</span></article></div>
    <div className="crm-toolbar"><form className="search-box" onSubmit={(e)=>{e.preventDefault();void load()}}><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="搜索账号、姓名"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option>{Object.entries(statusLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><select value={roleId} onChange={e=>setRoleId(e.target.value)}><option value="">全部角色</option>{options.roles.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><button>查询</button></form>{canCreate&&<button className="primary" onClick={openCreate}>＋ 新增用户</button>}</div>
    {error&&!selected&&!creating&&<div className="error block">{error}</div>}
    <div className="table-card"><div className="table-head"><strong>账号列表</strong><span>{loading?'读取中…':`${items.length} 条`}</span></div><div className="table-wrap"><table className="user-table"><thead><tr><th>用户</th><th>工号 / 职务</th><th>所属组织</th><th>角色</th><th>状态</th><th>最近登录</th><th/></tr></thead><tbody>{items.map(user=><tr key={user.id}><td><b>{user.displayName}</b><small>@{user.username}<br/>{user.phone||user.email||'未填写联系方式'}</small></td><td>{user.employeeNo||'—'}<small>{user.jobTitle||'未填写职务'}</small></td><td>{user.orgUnits.find(x=>x.isPrimary)?.orgUnit.name??'—'}<small>{user.orgUnits.length>1?`另属 ${user.orgUnits.length-1} 个组织`:'主组织'}</small></td><td><div className="tag-list">{user.roles.map(x=><em key={x.role.id??x.role.code}>{x.role.name}</em>)}</div></td><td><span className={`account-status ${user.status.toLowerCase()}`}>{statusLabels[user.status]}</span>{user.mustChangePassword&&<small>待修改密码</small>}</td><td>{user.lastLoginAt?new Date(user.lastLoginAt).toLocaleString('zh-CN'):'从未登录'}</td><td><button className="text-button" onClick={()=>openEdit(user)}>查看{canUpdate?' / 编辑':''}</button></td></tr>)}</tbody></table>{!loading&&!items.length&&<div className="empty">没有符合条件的用户</div>}</div></div>
    {(creating||selected)&&<div className="drawer-mask" onMouseDown={close}><section className="drawer access-drawer" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={close}>×</button><p className="eyebrow">{creating?'CREATE ACCOUNT':selected?.username}</p><h2>{creating?'新增统一账号':'账号资料与访问权限'}</h2>{notice&&<div className="success block">{notice}</div>}{error&&<div className="error block">{error}</div>}
      <form className="access-form" autoComplete="off" onSubmit={save}><h3>基础资料</h3><div className="form-grid"><label>登录账号<input required autoComplete="off" disabled={!creating} value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label>{creating&&<label>临时密码<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>}<label>姓名 / 显示名<input required value={form.displayName} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,displayName:e.target.value})}/></label><label>员工工号<input value={form.employeeNo} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,employeeNo:e.target.value})}/></label><label>手机号<input value={form.phone} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>邮箱<input type="email" value={form.email} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>职务<input value={form.jobTitle} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,jobTitle:e.target.value})}/></label><label>账号状态<select value={form.status} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(statusLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div><label>备注<textarea value={form.remark} disabled={!canUpdate&&!creating} onChange={e=>setForm({...form,remark:e.target.value})}/></label>
      <h3>角色（权限叠加）</h3><div className="choice-grid">{options.roles.map(role=><label className={form.roleIds.includes(role.id)?'checked':''} key={role.id}><input type="checkbox" checked={form.roleIds.includes(role.id)} disabled={!canUpdate&&!creating||!role.active} onChange={()=>toggleRole(role.id)}/><b>{role.name}</b><small>{role.code} · {role.dataScope}</small></label>)}</div>
      <h3>所属组织</h3><p className="helper">可属于多个部门；主组织用于默认数据范围和人员归属。当前主组织：{primaryUnit?.name??'未选择'}</p><div className="choice-grid org-choices">{options.orgUnits.filter(x=>x.active).map(unit=><label className={form.orgUnitIds.includes(unit.id)?'checked':''} key={unit.id}><input type="checkbox" checked={form.orgUnitIds.includes(unit.id)} disabled={!canUpdate&&!creating} onChange={()=>toggleUnit(unit.id)}/><b>{unit.name}</b><small>{unit.path}</small>{form.orgUnitIds.includes(unit.id)&&<span><input type="radio" name="primary" checked={form.primaryOrgUnitId===unit.id} disabled={!canUpdate&&!creating} onChange={()=>setForm({...form,primaryOrgUnitId:unit.id})}/>设为主组织</span>}</label>)}</div>
      {(canUpdate||creating)&&<button className="primary wide">{creating?'创建用户':'保存资料与权限'}</button>}</form>
      {selected&&canUpdate&&<form className="password-reset" onSubmit={reset}><h3>管理员重置密码</h3><p>重置后所有旧会话立即失效，用户下次登录必须修改临时密码。</p><div><input required minLength={8} type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="至少 8 位的新临时密码"/><button className="danger">重置密码</button></div></form>}
    </section></div>}
  </AppShell>;
}
