'use client';
import { useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { api } from '@/lib/api';

export function SystemDataPage({ title, subtitle, endpoint, columns }: { title: string; subtitle: string; endpoint: string; columns: { key: string; label: string }[] }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]); const [error, setError] = useState('');
  useEffect(() => { api<Record<string, unknown>[] | { items: Record<string, unknown>[] }>(endpoint).then((data) => setItems(Array.isArray(data) ? data : data.items)).catch((e: Error) => setError(e.message)); }, [endpoint]);
  const render = (value: unknown) => Array.isArray(value) ? `${value.length} 项` : typeof value === 'object' && value !== null ? '—' : String(value ?? '—');
  return <AppShell title={title} subtitle={subtitle}><div className="table-card"><div className="table-head"><strong>{title}</strong><span>{items.length} 条</span></div>{error ? <div className="error block">{error}</div> : <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={String(item.id ?? index)}>{columns.map((c) => <td key={c.key}>{render(item[c.key])}</td>)}</tr>)}</tbody></table>{!items.length && <div className="empty">正在读取数据…</div>}</div>}</div></AppShell>;
}

