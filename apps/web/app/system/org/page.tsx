import { SystemDataPage } from '@/components/SystemDataPage';
export default function Page() { return <SystemDataPage title="组织结构" subtitle="公司、部门、团队、工厂与仓库共用组织树。" endpoint="/system/org-units" columns={[{ key: 'code', label: '代码' }, { key: 'name', label: '名称' }, { key: 'type', label: '类型' }, { key: 'path', label: '组织路径' }]} />; }

