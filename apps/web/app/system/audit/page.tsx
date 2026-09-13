import { SystemDataPage } from '@/components/SystemDataPage';
export default function Page() { return <SystemDataPage title="审计日志" subtitle="关键操作、登录与资源变更均可追溯。" endpoint="/system/audit-logs" columns={[{ key: 'createdAt', label: '时间' }, { key: 'action', label: '动作' }, { key: 'resource', label: '资源' }, { key: 'ip', label: '来源 IP' }]} />; }
