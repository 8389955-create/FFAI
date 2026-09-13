'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, downloadApi, withQuery, type Principal } from '@/lib/api';
import { AppShell } from './AppShell';

type Customer = { id: string; customerNo: string; name: string };
type Project = { id: string; projectNo: string; name: string; customer: { id: string } };
type Product = { id: string; productNo: string; name: string; retailPrice?: string; unit: string; materialNameCn?: string; materialNameEn?: string };
type Item = { id: string; lineNo: number; description: string; materialName?: string; specification?: string; notes?: string; quantity: string; unit: string; unitPrice: string; discountRate: string; amount: string; product?: { productNo: string; name: string } };
type Quote = { id: string; quotationNo: string; title: string; status: string; subtotal: string; discountAmount: string; taxAmount: string; totalAmount: string; taxRate: string; validUntil?: string; notes?: string; terms?: string; customer: { id: string; customerNo: string; name: string; phone?: string }; project?: { id: string; projectNo: string; name: string }; owner: { displayName: string }; items?: Item[]; _count?: { items: number }; contract?: { id: string; contractNo: string; status: string } };
type Result = { items: Quote[]; total: number; summary: Record<string, number> };

const statuses: Record<string, string> = { DRAFT: '草稿', PENDING_APPROVAL: '待审批', APPROVED: '已审批', SENT: '已发送', ACCEPTED: '客户接受', REJECTED: '客户拒绝', EXPIRED: '已失效', CONVERTED: '已转合同' };
const money = (value: string | number = 0) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value));

function itemPayload(form: HTMLFormElement) {
  const raw = Object.fromEntries(new FormData(form));
  return {
    productId: raw.productId || undefined, description: String(raw.description || ''), materialName: raw.materialName || undefined,
    specification: raw.specification || undefined, notes: raw.notes || undefined, quantity: Number(raw.quantity), unit: raw.unit || undefined,
    unitPrice: raw.unitPrice === '' ? undefined : Number(raw.unitPrice), discountRate: raw.discountRate === '' ? undefined : Number(raw.discountRate) / 100,
  };
}

export function QuotationsPage() {
  const [data, setData] = useState<Result>({ items: [], total: 0, summary: {} });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [me, setMe] = useState<Principal | null>(null);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [quotes, cs, ps, productData, principal] = await Promise.all([
        api<Result>(withQuery('/commercial/quotations', { keyword, status })), api<{ items: Customer[] }>('/crm/customers?pageSize=100'),
        api<{ items: Project[] }>('/projects?pageSize=100'), api<{ items: Product[] }>('/pim/products?pageSize=100&status=ACTIVE'), api<Principal>('/me'),
      ]);
      setData(quotes); setCustomers(cs.items); setProjects(ps.items); setProducts(productData.items); setMe(principal);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取报价失败'); } finally { setLoading(false); }
  }, [keyword, status]);
  useEffect(() => { void load(); }, [load]);

  const canCreate = me?.permissions.includes('commercial.quote.create') ?? false;
  const canUpdate = me?.permissions.includes('commercial.quote.update') ?? false;
  const canApprove = me?.permissions.includes('commercial.quote.approve') ?? false;
  async function open(id: string) { try { setSelected(await api<Quote>(`/commercial/quotations/${id}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : '读取报价失败'); } }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form)); const values: Record<string, unknown> = {};
    Object.entries(raw).forEach(([key, value]) => { if (value !== '') values[key] = value; });
    if (values.taxRate !== undefined) values.taxRate = Number(values.taxRate); if (values.validUntil) values.validUntil = new Date(String(values.validUntil)).toISOString();
    try { const quote = await api<Quote>('/commercial/quotations', { method: 'POST', body: JSON.stringify(values) }); form.reset(); setShowCreate(false); await load(); await open(quote.id); } catch (cause) { setError(cause instanceof Error ? cause.message : '创建报价失败'); }
  }
  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = event.currentTarget; const values = itemPayload(form);
    const product = products.find((item) => item.id === values.productId); if (!values.description && product) values.description = product.name;
    if (!values.materialName && product) values.materialName = product.materialNameCn || product.materialNameEn;
    try { await api(`/commercial/quotations/${selected.id}/items`, { method: 'POST', body: JSON.stringify(values) }); form.reset(); await open(selected.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '新增明细失败'); }
  }
  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !editing) return;
    try { await api(`/commercial/quotations/${selected.id}/items/${editing.id}`, { method: 'PATCH', body: JSON.stringify(itemPayload(event.currentTarget)) }); setEditing(null); await open(selected.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '更新明细失败'); }
  }
  async function deleteItem(itemId: string) {
    if (!selected || !window.confirm('确认删除这条报价明细？')) return;
    try { await api(`/commercial/quotations/${selected.id}/items/${itemId}`, { method: 'DELETE' }); await open(selected.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '删除明细失败'); }
  }
  async function action(path: string, body?: unknown) {
    if (!selected) return;
    try { await api(`/commercial/quotations/${selected.id}/${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); await open(selected.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); }
  }
  async function download(kind: 'quotation' | 'contract', format: 'docx' | 'png') {
    if (!selected) return; const target = kind === 'contract' ? selected.contract?.id : selected.id; if (!target) return;
    const key = `${kind}-${format}`; setDownloading(key);
    try { const file = await downloadApi(`/commercial/${kind === 'contract' ? 'contracts' : 'quotations'}/${target}/export?format=${format}`); const url = URL.createObjectURL(file.blob); const link = document.createElement('a'); link.href = url; link.download = file.fileName; link.click(); URL.revokeObjectURL(url); } catch (cause) { setError(cause instanceof Error ? cause.message : '导出失败'); } finally { setDownloading(''); }
  }
  const pipeline = (data.summary.PENDING_APPROVAL ?? 0) + (data.summary.APPROVED ?? 0) + (data.summary.SENT ?? 0);

  return <AppShell title="报价合同中心" subtitle="完整管理产品、材质、规格、数量、价格、备注与审批，并导出正式 Word 或图片单据。">
    <div className="crm-stats"><article><span>报价总数</span><strong>{data.total}</strong></article><article><span>流转中</span><strong>{pipeline}</strong></article><article><span>待审批</span><strong>{data.summary.PENDING_APPROVAL ?? 0}</strong></article><article><span>已转合同</span><strong>{data.summary.CONVERTED ?? 0}</strong></article></div>
    <div className="crm-toolbar"><div className="search-box"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索报价编号、名称或客户"/><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部状态</option>{Object.entries(statuses).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></div>{canCreate && <button className="action" onClick={() => setShowCreate(true)}>＋ 新建报价</button>}</div>
    {error && <div className="error block">{error}</div>}
    <div className="crm-table"><table><thead><tr><th>报价单</th><th>客户 / 项目</th><th>金额</th><th>明细</th><th>负责人</th><th>状态</th></tr></thead><tbody>{data.items.map((quote) => <tr key={quote.id} onClick={() => void open(quote.id)}><td><b>{quote.title}</b><small>{quote.quotationNo}</small></td><td><b>{quote.customer.name}</b><small>{quote.project?.name ?? '未关联项目'}</small></td><td><b>{money(quote.totalAmount)}</b><small>含税 {money(quote.taxAmount)}</small></td><td>{quote._count?.items ?? 0} 项</td><td>{quote.owner.displayName}</td><td><span className={`state ${quote.status.toLowerCase()}`}>{statuses[quote.status]}</span></td></tr>)}</tbody></table>{loading && <div className="empty">正在读取报价…</div>}{!loading && !data.items.length && <div className="empty">暂无报价单</div>}</div>
    {showCreate && <div className="drawer-mask" onMouseDown={() => setShowCreate(false)}><section className="drawer" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setShowCreate(false)}>×</button><p className="eyebrow">NEW QUOTATION</p><h2>创建报价单</h2><form className="crm-form" onSubmit={create}><label>客户<select name="customerId" required defaultValue=""><option value="" disabled>请选择客户</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>关联项目<select name="projectId" defaultValue=""><option value="">暂不关联</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.projectNo}</option>)}</select></label><label>报价标题<input name="title" required placeholder="例如：全屋家具正式报价"/></label><div><label>税率<input name="taxRate" type="number" min="0" max="1" step="0.01" defaultValue="0"/></label><label>有效期<input name="validUntil" type="date"/></label></div><label>备注<textarea name="notes" rows={3} placeholder="交期、颜色、送装等整体备注"/></label><label>条款<textarea name="terms" rows={4} defaultValue="报价有效期内价格有效；生产前按合同约定支付定金。"/></label><button className="primary">创建并添加明细</button></form></section></div>}
    {selected && <div className="drawer-mask" onMouseDown={() => setSelected(null)}><section className="drawer quote-drawer" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><p className="eyebrow">{selected.quotationNo}</p><h2>{selected.title}</h2><div className="detail-meta"><span>{selected.customer.name}</span><span>{selected.project?.name ?? '未关联项目'}</span><span>{selected.owner.displayName}</span><span>{statuses[selected.status]}</span></div>
      <div className="quote-total"><div><small>小计</small><b>{money(selected.subtotal)}</b></div><i>−</i><div><small>整单优惠</small><b>{money(selected.discountAmount)}</b></div><i>＋</i><div><small>税额</small><b>{money(selected.taxAmount)}</b></div><i>＝</i><div className="grand"><small>报价总额</small><b>{money(selected.totalAmount)}</b></div></div>
      <div className="quote-actions"><button onClick={() => void download('quotation', 'docx')} disabled={!!downloading}>{downloading === 'quotation-docx' ? '生成中…' : '导出报价 Word'}</button><button onClick={() => void download('quotation', 'png')} disabled={!!downloading}>{downloading === 'quotation-png' ? '生成中…' : '导出报价图片'}</button>{selected.contract && <><button onClick={() => void download('contract', 'docx')} disabled={!!downloading}>导出合同 Word</button><button onClick={() => void download('contract', 'png')} disabled={!!downloading}>导出合同图片</button></>}</div>
      <h3>报价明细</h3><div className="quote-items">{selected.items?.map((item) => <article key={item.id}><span>{String(item.lineNo).padStart(2, '0')}</span><div><b>{item.description}</b><small>材质：{item.materialName || '-'} · 规格：{item.specification || '-'}</small><small>备注：{item.notes || '-'}</small></div><div><b>{item.quantity} {item.unit} × {money(item.unitPrice)}</b><small>优惠 {Number(item.discountRate) * 100}%</small></div><strong>{money(item.amount)}</strong>{selected.status === 'DRAFT' && canUpdate && <div><button type="button" onClick={() => setEditing(item)}>编辑</button><button type="button" className="danger" onClick={() => void deleteItem(item.id)}>删除</button></div>}</article>)}</div>
      {selected.status === 'DRAFT' && canUpdate && <form className="quote-item-form" onSubmit={addItem}><select name="productId" defaultValue=""><option value="">自定义项目</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {money(product.retailPrice)}</option>)}</select><input name="description" placeholder="完整产品名称（选品时自动带入）"/><input name="materialName" placeholder="材质（选品时自动带入）"/><input name="specification" placeholder="规格 / 尺寸 / 颜色"/><input name="quantity" type="number" step="0.001" min="0.001" required defaultValue="1"/><input name="unit" placeholder="单位" defaultValue="件"/><input name="unitPrice" type="number" step="0.01" min="0" placeholder="单价（留空取 PIM 价格）"/><input name="discountRate" type="number" min="0" max="100" placeholder="优惠 %"/><textarea name="notes" rows={2} placeholder="本项备注：工艺、交期、安装等"/><button className="action">添加明细</button></form>}
      <div className="quote-actions">{selected.status === 'DRAFT' && canUpdate && <button onClick={() => void action('submit')}>提交审批</button>}{selected.status === 'PENDING_APPROVAL' && canApprove && <button onClick={() => void action('approve')}>审批通过</button>}{selected.status === 'APPROVED' && canUpdate && <button onClick={() => void action('transition', { status: 'SENT' })}>标记已发送</button>}{selected.status === 'SENT' && canUpdate && <><button onClick={() => void action('transition', { status: 'ACCEPTED' })}>客户接受</button><button className="danger" onClick={() => void action('transition', { status: 'REJECTED' })}>客户拒绝</button></>}{selected.status === 'ACCEPTED' && canUpdate && <button onClick={() => void action('contract')}>生成合同</button>}{selected.contract && <span>合同：{selected.contract.contractNo} · {selected.contract.status}</span>}</div>{selected.notes && <><h3>报价备注</h3><p className="intent">{selected.notes}</p></>}{selected.terms && <><h3>报价条款</h3><p className="intent">{selected.terms}</p></>}
    </section></div>}
    {editing && selected && <div className="drawer-mask" onMouseDown={() => setEditing(null)}><section className="drawer" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setEditing(null)}>×</button><p className="eyebrow">EDIT LINE {editing.lineNo}</p><h2>编辑报价明细</h2><form className="crm-form" onSubmit={updateItem}><label>产品名称<input name="description" required defaultValue={editing.description}/></label><label>材质<input name="materialName" defaultValue={editing.materialName}/></label><label>规格 / 尺寸 / 颜色<input name="specification" defaultValue={editing.specification}/></label><div><label>数量<input name="quantity" type="number" step="0.001" min="0.001" required defaultValue={editing.quantity}/></label><label>单位<input name="unit" required defaultValue={editing.unit}/></label></div><div><label>单价<input name="unitPrice" type="number" step="0.01" min="0" required defaultValue={editing.unitPrice}/></label><label>优惠 %<input name="discountRate" type="number" min="0" max="100" defaultValue={Number(editing.discountRate) * 100}/></label></div><label>备注<textarea name="notes" rows={4} defaultValue={editing.notes}/></label><button className="primary">保存明细</button></form></section></div>}
  </AppShell>;
}
