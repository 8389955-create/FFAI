import { AppShell } from '@/components/AppShell';
const centers = [
  ['CRM', '客户关系', '客户与线索统一视图', 'ready'], ['项目设计', '方案协同', '空间、方案与版本', 'ready'],
  ['PIM', '产品中心', '产品、材质与 CAD', 'ready'], ['报价合同', '交易前台', '报价、合同与审批', 'ready'],
  ['OMS', '订单中心', '订单全生命周期', 'ready'], ['SCM', '供应链', '采购与供应商协同', 'ready'],
  ['MES', '生产执行', '排产、工单与报工', 'ready'], ['WMS', '仓储中心', '原料与成品库存', 'ready'],
  ['财务', '经营核算', '收付、成本与利润', 'ready'], ['履约', '交付售后', '物流、安装与售后', 'ready'],
  ['预警', '任务中心', '待办、超期与异常', 'ready'], ['BI / AI', '智能决策', '指标、预测与助手', 'ready'],
];
export default function Dashboard() { return <AppShell title="经营工作台" subtitle="从客户、设计、产品、报价到生产、库存、财务、履约和智能决策的主业务链已投入本地运行。">
  <div className="hero-card"><div><span className="pill">SPRINT 0</span><h2>一个系统，一套可信数据底座</h2><p>统一用户、组织、权限与审计已形成业务中心的公共基础设施。</p></div><div className="hero-stat"><strong>15</strong><span>标准角色</span></div><div className="hero-stat"><strong>12</strong><span>业务中心</span></div><div className="hero-stat"><strong>3</strong><span>权限维度</span></div></div>
  <div className="section-title"><div><h3>业务中心</h3><p>已启用模块均接入统一账号、权限、组织、审计与 PostgreSQL 数据底座。</p></div></div>
  <div className="center-grid">{centers.map(([code, name, description, status]) => <article key={code}><div className="center-icon">{code.slice(0, 2)}</div><div><span className={`mini ${status}`}>{status === 'ready' ? '基础就绪' : '已预留'}</span><h4>{name}</h4><p>{description}</p></div></article>)}</div>
  <div className="foundation"><h3>权限决策链</h3><div className="flow"><span>统一用户</span><b>→</b><span>多角色合并</span><b>→</b><span>功能权限</span><b>→</b><span>数据范围</span><b>→</b><span>字段权限</span><b>→</b><span>审计留痕</span></div></div>
  </AppShell>; }
