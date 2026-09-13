'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Principal } from '@/lib/api';
import { AppShell } from './AppShell';

type Location = { id: string; code: string; name: string; zone?: string; active: boolean };
type Warehouse = { id: string; code: string; name: string; type: string; address?: string; active: boolean; locations: Location[]; _count: { balances: number } };
type Stock = { id: string; quantity: string; reservedQuantity: string; availableQuantity: number; unit: string; warehouse: Warehouse; location: Location; product: { id: string; productNo: string; name: string; type: string }; sku?: { id: string; skuCode: string; name: string } };
type Transaction = { id: string; transactionNo: string; type: string; quantity: string; beforeQuantity: string; afterQuantity: string; unit: string; referenceType?: string; referenceId?: string; note?: string; createdAt: string; warehouse: Warehouse; location: Location; product: { productNo: string; name: string }; sku?: { skuCode: string; name: string }; operator: { displayName: string } };
type PurchaseItem = { id: string; description: string; quantity: string; receivedQuantity: string; remainingQuantity: number; unit: string; purchaseOrder: { purchaseOrderNo: string; supplier: { name: string } }; product?: { productNo: string; name: string } };
type ProductionItem = { id: string; description: string; completedQuantity: string; receivedQuantity: number; remainingQuantity: number; unit: string; productionOrder: { productionOrderNo: string }; product?: { productNo: string; name: string } };
type Paged<T> = { items: T[]; total: number };

const txNames: Record<string, string> = { PURCHASE_RECEIPT: '采购入库', PRODUCTION_RECEIPT: '生产入库', SALES_ISSUE: '销售/领用出库', TRANSFER_IN: '调拨入库', TRANSFER_OUT: '调拨出库', ADJUSTMENT_IN: '盘盈调整', ADJUSTMENT_OUT: '盘亏调整' };
const warehouseTypes: Record<string, string> = { RAW_MATERIAL: '原料仓', WORK_IN_PROGRESS: '在制品仓', FINISHED_GOODS: '成品仓', MIXED: '综合仓' };

export function InventoryPage() {
  const [stocks, setStocks] = useState<Paged<Stock>>({ items: [], total: 0 });
  const [transactions, setTransactions] = useState<Paged<Transaction>>({ items: [], total: 0 });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [me, setMe] = useState<Principal | null>(null);
  const [keyword, setKeyword] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [dialog, setDialog] = useState<'warehouse' | 'purchase' | 'production' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = `keyword=${encodeURIComponent(keyword)}&warehouseId=${warehouseId}&pageSize=100`;
      const [inventory, txs, whs, purchases, productions, principal] = await Promise.all([
        api<Paged<Stock>>(`/wms/inventory?${query}`), api<Paged<Transaction>>(`/wms/transactions?${query}`), api<Warehouse[]>('/wms/warehouses'),
        api<PurchaseItem[]>('/wms/receivable-purchase-items').catch(() => []), api<ProductionItem[]>('/wms/receivable-production-items').catch(() => []), api<Principal>('/me'),
      ]);
      setStocks(inventory); setTransactions(txs); setWarehouses(whs); setPurchaseItems(purchases); setProductionItems(productions); setMe(principal);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取仓储数据失败'); }
    finally { setLoading(false); }
  }, [keyword, warehouseId]);
  useEffect(() => { void load(); }, [load]);

  const locations = useMemo(() => warehouses.flatMap((warehouse) => warehouse.locations.map((location) => ({ ...location, warehouseName: warehouse.name }))), [warehouses]);
  const totalQuantity = stocks.items.reduce((sum, stock) => sum + Number(stock.quantity), 0);
  const canManage = me?.permissions.includes('wms.warehouse.manage') ?? false;
  const canReceive = me?.permissions.includes('wms.stock.receive') ?? false;
  const canIssue = me?.permissions.includes('wms.stock.issue') ?? false;
  const canTransfer = me?.permissions.includes('wms.stock.transfer') ?? false;
  const canAdjust = me?.permissions.includes('wms.stock.adjust') ?? false;

  async function submit(path: string, form: HTMLFormElement, transform: (data: Record<string, FormDataEntryValue>) => Record<string, unknown>) {
    const data = Object.fromEntries(new FormData(form));
    try { await api(path, { method: 'POST', body: JSON.stringify(transform(data)) }); form.reset(); setDialog(null); setSelectedStock(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '库存操作失败'); }
  }
  function receipt(e: FormEvent<HTMLFormElement>, kind: 'purchase' | 'production') {
    e.preventDefault(); const form = e.currentTarget;
    void submit(`/wms/receipts/${kind}`, form, (data) => ({ [`${kind}OrderItemId`]: data.itemId, locationId: data.locationId, quantity: Number(data.quantity), batchNo: data.batchNo || undefined, note: data.note || undefined }));
  }
  function createWarehouse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget;
    void submit('/wms/warehouses', form, (data) => ({ code: data.code, name: data.name, type: data.type, address: data.address || undefined }));
  }
  function createLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedWarehouse) return; const form = e.currentTarget;
    void submit(`/wms/warehouses/${selectedWarehouse.id}/locations`, form, (data) => ({ code: data.code, name: data.name, zone: data.zone || undefined }));
  }
  function stockAction(e: FormEvent<HTMLFormElement>, action: 'issues' | 'transfers' | 'adjustments') {
    e.preventDefault(); if (!selectedStock) return; const form = e.currentTarget;
    void submit(`/wms/${action}`, form, (data) => action === 'transfers' ? { fromLocationId: selectedStock.location.id, toLocationId: data.toLocationId, productId: selectedStock.product.id, skuId: selectedStock.sku?.id, quantity: Number(data.quantity), unit: selectedStock.unit, note: data.note || undefined } : action === 'issues' ? { locationId: selectedStock.location.id, productId: selectedStock.product.id, skuId: selectedStock.sku?.id, quantity: Number(data.quantity), unit: selectedStock.unit, referenceType: data.referenceType || undefined, referenceId: data.referenceId || undefined, note: data.note || undefined } : { locationId: selectedStock.location.id, productId: selectedStock.product.id, skuId: selectedStock.sku?.id, quantityChange: Number(data.quantityChange), unit: selectedStock.unit, reason: data.reason, confirm: true });
  }

  return <AppShell title="WMS 仓储库存中心" subtitle="采购、生产、调拨、出库与盘点统一形成不可跳号的库存流水，数量变动在数据库事务内完成。">
    <div className="crm-stats"><article><span>库存品项</span><strong>{stocks.total}</strong></article><article><span>库存总量</span><strong>{totalQuantity.toLocaleString('zh-CN')}</strong></article><article><span>待采购入库</span><strong>{purchaseItems.length}</strong></article><article><span>待生产入库</span><strong>{productionItems.length}</strong></article></div>
    <div className="warehouse-strip">{warehouses.map((warehouse) => <article key={warehouse.id} onClick={() => setSelectedWarehouse(warehouse)}><div><b>{warehouse.name}</b><small>{warehouse.code} · {warehouseTypes[warehouse.type]}</small></div><span>{warehouse.locations.length}<small>库位</small></span><span>{warehouse._count.balances}<small>品项</small></span></article>)}</div>
    <div className="crm-toolbar"><div className="search-box"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索产品、SKU 或流水"/><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">全部仓库</option>{warehouses.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}</select></div><div className="toolbar-actions">{canManage && <button className="secondary-action" onClick={() => setDialog('warehouse')}>＋ 新建仓库</button>}{canReceive && <button className="secondary-action" onClick={() => setDialog('purchase')}>采购入库</button>}{canReceive && <button className="action" onClick={() => setDialog('production')}>生产入库</button>}</div></div>
    {error && <div className="error block">{error}</div>}
    <div className="inventory-layout"><section><div className="section-title"><div><h3>实时库存</h3><p>可用量 = 在库量 − 预留量；点击品项可调拨、出库或盘点调整。</p></div></div><div className="crm-table"><table><thead><tr><th>产品</th><th>仓库 / 库位</th><th>在库</th><th>预留</th><th>可用</th></tr></thead><tbody>{stocks.items.map((stock) => <tr key={stock.id} onClick={() => setSelectedStock(stock)}><td><b>{stock.product.name}</b><small>{stock.product.productNo}{stock.sku ? ` · ${stock.sku.skuCode}` : ''}</small></td><td><b>{stock.warehouse.name}</b><small>{stock.location.code} · {stock.location.name}</small></td><td><b>{stock.quantity} {stock.unit}</b></td><td>{stock.reservedQuantity} {stock.unit}</td><td><strong className="stock-available">{stock.availableQuantity} {stock.unit}</strong></td></tr>)}</tbody></table>{loading && <div className="empty">正在读取实时库存…</div>}</div></section>
      <aside><div className="section-title"><div><h3>最近流水</h3><p>每次库存变化均记录前后数量。</p></div></div><div className="stock-ledger">{transactions.items.slice(0, 12).map((tx) => <article key={tx.id}><i className={Number(tx.quantity) >= 0 ? 'in' : 'out'}>{Number(tx.quantity) >= 0 ? '入' : '出'}</i><div><b>{txNames[tx.type] ?? tx.type} · {tx.product.name}</b><small>{tx.transactionNo} · {tx.location.code} · {tx.operator.displayName}</small><span>{tx.beforeQuantity} → {tx.afterQuantity} {tx.unit}{tx.referenceId ? ` · ${tx.referenceId}` : ''}</span></div><strong>{Number(tx.quantity) > 0 ? '+' : ''}{tx.quantity}</strong></article>)}</div></aside></div>
    {dialog === 'warehouse' && <Dialog close={() => setDialog(null)} eyebrow="WAREHOUSE MASTER" title="新建仓库"><form className="crm-form" onSubmit={createWarehouse}><div><label>仓库代码<input name="code" required/></label><label>仓库名称<input name="name" required/></label></div><label>仓库类型<select name="type" defaultValue="MIXED">{Object.entries(warehouseTypes).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label><label>地址<input name="address"/></label><button className="primary">保存仓库</button></form></Dialog>}
    {dialog === 'purchase' && <Dialog close={() => setDialog(null)} eyebrow="PURCHASE RECEIPT" title="采购入库"><form className="crm-form" onSubmit={(e) => receipt(e, 'purchase')}><label>待收采购明细<select name="itemId" required defaultValue=""><option value="" disabled>请选择</option>{purchaseItems.map((item) => <option value={item.id} key={item.id}>{item.purchaseOrder.purchaseOrderNo} · {item.description} · 待收 {item.remainingQuantity} {item.unit}</option>)}</select></label><LocationSelect locations={locations}/><div><label>本次数量<input name="quantity" type="number" step="0.001" min="0.001" required/></label><label>批次号<input name="batchNo"/></label></div><label>备注<textarea name="note" rows={3}/></label><button className="primary">确认采购入库</button></form></Dialog>}
    {dialog === 'production' && <Dialog close={() => setDialog(null)} eyebrow="PRODUCTION RECEIPT" title="生产完工入库"><form className="crm-form" onSubmit={(e) => receipt(e, 'production')}><label>待入库生产明细<select name="itemId" required defaultValue=""><option value="" disabled>请选择</option>{productionItems.map((item) => <option value={item.id} key={item.id}>{item.productionOrder.productionOrderNo} · {item.description} · 待入 {item.remainingQuantity} {item.unit}</option>)}</select></label><LocationSelect locations={locations}/><div><label>本次数量<input name="quantity" type="number" step="0.001" min="0.001" required/></label><label>批次号<input name="batchNo"/></label></div><label>备注<textarea name="note" rows={3}/></label><button className="primary">确认生产入库</button></form></Dialog>}
    {selectedWarehouse && <Dialog close={() => setSelectedWarehouse(null)} eyebrow={selectedWarehouse.code} title={selectedWarehouse.name}><div className="location-list">{selectedWarehouse.locations.map((location) => <article key={location.id}><b>{location.code}</b><span>{location.name}</span><small>{location.zone ?? '未设置分区'}</small></article>)}</div>{canManage && <form className="compact-form" onSubmit={createLocation}><input name="code" placeholder="库位代码" required/><input name="name" placeholder="库位名称" required/><input name="zone" placeholder="所属分区"/><button className="action">新增库位</button></form>}</Dialog>}
    {selectedStock && <Dialog close={() => setSelectedStock(null)} eyebrow={`${selectedStock.warehouse.code} / ${selectedStock.location.code}`} title={selectedStock.product.name}><div className="stock-focus"><article><small>在库</small><b>{selectedStock.quantity} {selectedStock.unit}</b></article><article><small>预留</small><b>{selectedStock.reservedQuantity} {selectedStock.unit}</b></article><article><small>可用</small><b>{selectedStock.availableQuantity} {selectedStock.unit}</b></article></div>{canTransfer && <form className="stock-action-form" onSubmit={(e) => stockAction(e, 'transfers')}><b>库存调拨</b><select name="toLocationId" required defaultValue=""><option value="" disabled>调入库位</option>{locations.filter((location) => location.id !== selectedStock.location.id).map((location) => <option key={location.id} value={location.id}>{location.warehouseName} / {location.code}</option>)}</select><input name="quantity" type="number" step="0.001" min="0.001" placeholder="数量" required/><input name="note" placeholder="备注"/><button>调拨</button></form>}{canIssue && <form className="stock-action-form" onSubmit={(e) => stockAction(e, 'issues')}><b>库存出库</b><input name="quantity" type="number" step="0.001" min="0.001" placeholder="数量" required/><input name="referenceId" placeholder="来源单号"/><input name="note" placeholder="用途"/><button>出库</button></form>}{canAdjust && <form className="stock-action-form" onSubmit={(e) => stockAction(e, 'adjustments')}><b>盘点调整</b><input name="quantityChange" type="number" step="0.001" placeholder="差异数量（可为负）" required/><input name="reason" placeholder="调整原因" required/><button>确认调整</button></form>}</Dialog>}
  </AppShell>;
}

function Dialog({ close, eyebrow, title, children }: { close: () => void; eyebrow: string; title: string; children: React.ReactNode }) { return <div className="drawer-mask" onMouseDown={close}><section className="drawer wms-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={close}>×</button><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children}</section></div>; }
function LocationSelect({ locations }: { locations: Array<Location & { warehouseName: string }> }) { return <label>入库库位<select name="locationId" required defaultValue=""><option value="" disabled>请选择仓库 / 库位</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.warehouseName} / {location.code} · {location.name}</option>)}</select></label>; }
