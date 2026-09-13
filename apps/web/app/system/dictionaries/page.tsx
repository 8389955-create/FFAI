import { SystemDataPage } from '@/components/SystemDataPage';
export default function Page() { return <SystemDataPage title="数据字典" subtitle="跨业务中心复用的可配置枚举与显示值。" endpoint="/system/dictionaries" columns={[{ key: 'code', label: '字典代码' }, { key: 'name', label: '字典名称' }, { key: 'items', label: '字典项' }, { key: 'updatedAt', label: '更新时间' }]} />; }

