import { PrismaClient, DataScopeType, MenuType, OrgUnitType } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const roleDefinitions = [
  ['OWNER', '老板'], ['ADMIN', '管理员'], ['SALES', '销售'], ['CUSTOMER_SERVICE', '客服'],
  ['INTERNAL_DESIGNER', '内部设计师'], ['PARTNER_DESIGNER', '外部合作设计师'], ['FACTORY_DIRECTOR', '厂长'],
  ['WORKER', '工人师傅'], ['QUALITY_INSPECTOR', '质检'], ['WAREHOUSE', '仓库'], ['FINANCE', '财务'],
  ['PURCHASING', '采购'], ['INSTALLER', '物流安装'], ['DEALER', '经销商'], ['CUSTOMER', '客户'],
] as const;

const permissionDefinitions = [
  ['system.dashboard.read', '查看工作台', 'system.dashboard', 'read'],
  ['system.user.read', '查看用户', 'system.user', 'read'],
  ['system.user.create', '新增用户', 'system.user', 'create'],
  ['system.user.update', '编辑用户', 'system.user', 'update'],
  ['system.role.read', '查看角色', 'system.role', 'read'],
  ['system.role.manage', '管理角色权限', 'system.role', 'manage'],
  ['system.org.read', '查看组织', 'system.org', 'read'],
  ['system.org.manage', '管理组织', 'system.org', 'manage'],
  ['system.dict.manage', '管理数据字典', 'system.dict', 'manage'],
  ['system.audit.read', '查看审计日志', 'system.audit', 'read'],
  ['system.attachment.create', '上传附件', 'system.attachment', 'create'],
  ['crm.customer.read', '查看客户', 'crm.customer', 'read'],
  ['crm.customer.create', '新增客户', 'crm.customer', 'create'],
  ['crm.customer.update', '编辑客户', 'crm.customer', 'update'],
  ['crm.lead.read', '查看线索', 'crm.lead', 'read'],
  ['crm.lead.create', '新增线索', 'crm.lead', 'create'],
  ['crm.lead.update', '编辑线索', 'crm.lead', 'update'],
  ['crm.activity.create', '新增跟进', 'crm.activity', 'create'],
  ['project.read', '查看项目', 'project', 'read'],
  ['project.create', '新增项目', 'project', 'create'],
  ['project.update', '编辑项目', 'project', 'update'],
  ['project.space.manage', '管理项目空间', 'project.space', 'manage'],
  ['project.design.manage', '管理设计版本', 'project.design', 'manage'],
  ['pim.product.read', '查看产品', 'pim.product', 'read'],
  ['pim.product.create', '新增产品', 'pim.product', 'create'],
  ['pim.product.update', '编辑产品', 'pim.product', 'update'],
  ['pim.product.publish', '发布产品', 'pim.product', 'publish'],
  ['pim.cost.read', '查看产品成本', 'pim.cost', 'read'],
  ['pim.category.manage', '管理产品分类', 'pim.category', 'manage'],
  ['pim.asset.manage', '管理产品素材', 'pim.asset', 'manage'],
  ['commercial.quote.read', '查看报价', 'commercial.quote', 'read'],
  ['commercial.quote.create', '新增报价', 'commercial.quote', 'create'],
  ['commercial.quote.update', '编辑报价', 'commercial.quote', 'update'],
  ['commercial.quote.approve', '审批报价', 'commercial.quote', 'approve'],
  ['commercial.contract.read', '查看合同', 'commercial.contract', 'read'],
  ['commercial.contract.create', '创建合同', 'commercial.contract', 'create'],
  ['commercial.contract.update', '编辑合同', 'commercial.contract', 'update'],
  ['oms.order.read', '查看销售订单', 'oms.order', 'read'],
  ['oms.order.create', '创建销售订单', 'oms.order', 'create'],
  ['oms.order.update', '编辑销售订单', 'oms.order', 'update'],
  ['oms.order.confirm', '确认销售订单', 'oms.order', 'confirm'],
  ['scm.supplier.read', '查看供应商', 'scm.supplier', 'read'],
  ['scm.supplier.manage', '管理供应商', 'scm.supplier', 'manage'],
  ['scm.purchase.read', '查看采购单', 'scm.purchase', 'read'],
  ['scm.purchase.create', '创建采购单', 'scm.purchase', 'create'],
  ['scm.purchase.update', '编辑采购单', 'scm.purchase', 'update'],
  ['scm.purchase.approve', '审批采购单', 'scm.purchase', 'approve'],
  ['scm.purchase.receive', '采购收货', 'scm.purchase', 'receive'],
  ['mes.production.read', '查看生产订单', 'mes.production', 'read'],
  ['mes.production.create', '创建生产订单', 'mes.production', 'create'],
  ['mes.production.release', '下达生产订单', 'mes.production', 'release'],
  ['mes.production.update', '管理生产订单', 'mes.production', 'update'],
  ['mes.workorder.read', '查看工单', 'mes.workorder', 'read'],
  ['mes.workorder.manage', '派工与工单管理', 'mes.workorder', 'manage'],
  ['mes.workorder.report', '生产报工', 'mes.workorder', 'report'],
  ['wms.warehouse.read', '查看仓库', 'wms.warehouse', 'read'],
  ['wms.warehouse.manage', '管理仓库与库位', 'wms.warehouse', 'manage'],
  ['wms.inventory.read', '查看库存与流水', 'wms.inventory', 'read'],
  ['wms.stock.receive', '采购与生产入库', 'wms.stock', 'receive'],
  ['wms.stock.issue', '销售与生产出库', 'wms.stock', 'issue'],
  ['wms.stock.transfer', '库存调拨', 'wms.stock', 'transfer'],
  ['wms.stock.adjust', '库存调整', 'wms.stock', 'adjust'],
  ['finance.dashboard.read', '查看财务总览', 'finance.dashboard', 'read'],
  ['finance.receivable.read', '查看应收账款', 'finance.receivable', 'read'],
  ['finance.receivable.collect', '登记客户收款', 'finance.receivable', 'collect'],
  ['finance.payable.read', '查看应付账款', 'finance.payable', 'read'],
  ['finance.payable.pay', '登记供应商付款', 'finance.payable', 'pay'],
  ['finance.expense.read', '查看费用', 'finance.expense', 'read'],
  ['finance.expense.create', '新增费用', 'finance.expense', 'create'],
  ['finance.expense.approve', '审批费用', 'finance.expense', 'approve'],
  ['finance.expense.pay', '支付费用', 'finance.expense', 'pay'],
  ['finance.payroll.read', '查看工资', 'finance.payroll', 'read'],
  ['finance.payroll.manage', '管理工资单', 'finance.payroll', 'manage'],
  ['finance.payroll.pay', '支付工资', 'finance.payroll', 'pay'],
  ['fulfillment.shipment.read', '查看配送任务', 'fulfillment.shipment', 'read'],
  ['fulfillment.shipment.create', '创建配送任务', 'fulfillment.shipment', 'create'],
  ['fulfillment.shipment.dispatch', '配送出库发车', 'fulfillment.shipment', 'dispatch'],
  ['fulfillment.shipment.deliver', '确认配送签收', 'fulfillment.shipment', 'deliver'],
  ['fulfillment.installation.read', '查看安装任务', 'fulfillment.installation', 'read'],
  ['fulfillment.installation.manage', '安排安装任务', 'fulfillment.installation', 'manage'],
  ['fulfillment.installation.report', '安装开工与完工', 'fulfillment.installation', 'report'],
  ['fulfillment.aftersales.read', '查看售后工单', 'fulfillment.aftersales', 'read'],
  ['fulfillment.aftersales.create', '创建售后工单', 'fulfillment.aftersales', 'create'],
  ['fulfillment.aftersales.manage', '受理与处理售后', 'fulfillment.aftersales', 'manage'],
  ['task.read', '查看任务', 'task', 'read'],
  ['task.create', '创建任务', 'task', 'create'],
  ['task.manage', '更新任务', 'task', 'manage'],
  ['alert.read', '查看预警', 'alert', 'read'],
  ['alert.scan', '执行预警扫描', 'alert', 'scan'],
  ['alert.manage', '确认与解决预警', 'alert', 'manage'],
  ['analytics.dashboard.read', '查看经营分析', 'analytics.dashboard', 'read'],
  ['analytics.snapshot.generate', '生成指标快照', 'analytics.snapshot', 'generate'],
  ['ai.insight.read', '查看智能洞察', 'ai.insight', 'read'],
  ['ai.insight.generate', '生成智能洞察', 'ai.insight', 'generate'],
  ['ai.insight.manage', '管理智能洞察', 'ai.insight', 'manage'],
  ['integration.read', '查看集成中心', 'integration', 'read'],
  ['integration.manage', '管理渠道配置', 'integration', 'manage'],
  ['integration.client.manage', '管理 API 客户端', 'integration.client', 'manage'],
  ['integration.webhook.manage', '管理 Webhook', 'integration.webhook', 'manage'],
  ['integration.webhook.dispatch', '投递 Webhook', 'integration.webhook', 'dispatch'],
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for seeding.');
  const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
  const isLocalDatabase = ['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'].includes(databaseHost);
  const adminPassword = process.env.FFAI_SEED_ADMIN_PASSWORD ?? (isLocalDatabase ? 'Admin123!' : undefined);
  if (!adminPassword) throw new Error('Remote database seeding requires FFAI_SEED_ADMIN_PASSWORD.');
  const demoPassword = (localPassword: string) => isLocalDatabase ? localPassword : randomBytes(24).toString('base64url');
  const demoStatus = isLocalDatabase ? 'ACTIVE' as const : 'DISABLED' as const;

  const organization = await prisma.organization.upsert({
    where: { code: 'FFAI_DEMO' },
    update: {},
    create: { code: 'FFAI_DEMO', name: '家具工厂 AI 系统演示企业' },
  });

  const company = await prisma.orgUnit.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'HQ' } },
    update: {},
    create: { organizationId: organization.id, code: 'HQ', name: '总公司', type: OrgUnitType.COMPANY, path: '/HQ' },
  });
  for (const [code, name, type] of [
    ['SALES', '销售部', OrgUnitType.DEPARTMENT], ['DESIGN', '设计部', OrgUnitType.DEPARTMENT],
    ['FACTORY', '生产工厂', OrgUnitType.FACTORY], ['FINANCE', '财务部', OrgUnitType.DEPARTMENT],
  ] as const) {
    await prisma.orgUnit.upsert({
      where: { organizationId_code: { organizationId: organization.id, code } }, update: {},
      create: { organizationId: organization.id, parentId: company.id, code, name, type, path: `/HQ/${code}` },
    });
  }

  const permissions = [];
  for (const [code, name, resource, action] of permissionDefinitions) {
    permissions.push(await prisma.permission.upsert({ where: { code }, update: { name }, create: { code, name, resource, action } }));
  }

  const roles = new Map<string, { id: string }>();
  for (const [code, name] of roleDefinitions) {
    const dataScope = code === 'OWNER' || code === 'ADMIN' ? DataScopeType.ALL : ['CUSTOMER_SERVICE', 'FACTORY_DIRECTOR', 'QUALITY_INSPECTOR', 'WAREHOUSE', 'FINANCE', 'PURCHASING'].includes(code) ? DataScopeType.COMPANY : DataScopeType.SELF;
    const role = await prisma.role.upsert({
      where: { organizationId_code: { organizationId: organization.id, code } },
      update: { name, dataScope },
      create: { organizationId: organization.id, code, name, isSystem: true, dataScope },
    });
    roles.set(code, role);
  }

  const menus = [];
  for (const [code, name, path, sort] of [
    ['dashboard', '经营工作台', '/dashboard', 10], ['users', '用户管理', '/system/users', 20],
    ['roles', '角色权限', '/system/roles', 30], ['org', '组织结构', '/system/org', 40],
    ['dictionary', '数据字典', '/system/dictionaries', 50], ['audit', '审计日志', '/system/audit', 60],
  ] as const) {
    menus.push(await prisma.menu.upsert({ where: { code }, update: { name, path, sort }, create: { code, name, path, sort, type: MenuType.MENU } }));
  }
  const crmMenu = await prisma.menu.upsert({ where: { code: 'crm' }, update: { name: 'CRM 客户中心', sort: 15 }, create: { code: 'crm', name: 'CRM 客户中心', sort: 15, type: MenuType.DIRECTORY } });
  menus.push(crmMenu);
  for (const [code, name, path, sort, permissionCode] of [
    ['crm-customers', '客户管理', '/crm/customers', 10, 'crm.customer.read'],
    ['crm-leads', '线索管理', '/crm/leads', 20, 'crm.lead.read'],
  ] as const) {
    menus.push(await prisma.menu.upsert({ where: { code }, update: { name, path, sort, parentId: crmMenu.id, permissionCode }, create: { code, name, path, sort, parentId: crmMenu.id, permissionCode, type: MenuType.MENU } }));
  }
  menus.push(await prisma.menu.upsert({
    where: { code: 'projects' }, update: { name: '项目设计', path: '/projects', sort: 18, permissionCode: 'project.read' },
    create: { code: 'projects', name: '项目设计', path: '/projects', sort: 18, permissionCode: 'project.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'mes-production' }, update: { name: 'MES 生产执行', path: '/mes/production', sort: 23, permissionCode: 'mes.production.read' },
    create: { code: 'mes-production', name: 'MES 生产执行', path: '/mes/production', sort: 23, permissionCode: 'mes.production.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'wms-inventory' }, update: { name: 'WMS 仓储库存', path: '/wms/inventory', sort: 24, permissionCode: 'wms.inventory.read' },
    create: { code: 'wms-inventory', name: 'WMS 仓储库存', path: '/wms/inventory', sort: 24, permissionCode: 'wms.inventory.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'finance-center' }, update: { name: '财务经营核算', path: '/finance', sort: 25, permissionCode: 'finance.dashboard.read' },
    create: { code: 'finance-center', name: '财务经营核算', path: '/finance', sort: 25, permissionCode: 'finance.dashboard.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'fulfillment-center' }, update: { name: '物流安装售后', path: '/fulfillment', sort: 26, permissionCode: 'fulfillment.shipment.read' },
    create: { code: 'fulfillment-center', name: '物流安装售后', path: '/fulfillment', sort: 26, permissionCode: 'fulfillment.shipment.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'task-alert-center' }, update: { name: '任务预警中心', path: '/tasks', sort: 27, permissionCode: 'task.read' },
    create: { code: 'task-alert-center', name: '任务预警中心', path: '/tasks', sort: 27, permissionCode: 'task.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'analytics-center' }, update: { name: 'BI / AI 智能决策', path: '/analytics', sort: 28, permissionCode: 'analytics.dashboard.read' },
    create: { code: 'analytics-center', name: 'BI / AI 智能决策', path: '/analytics', sort: 28, permissionCode: 'analytics.dashboard.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'integration-center' }, update: { name: '多端集成中心', path: '/integrations', sort: 29, permissionCode: 'integration.read' },
    create: { code: 'integration-center', name: '多端集成中心', path: '/integrations', sort: 29, permissionCode: 'integration.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'scm-purchasing' }, update: { name: 'SCM 供应链', path: '/scm/purchasing', sort: 22, permissionCode: 'scm.purchase.read' },
    create: { code: 'scm-purchasing', name: 'SCM 供应链', path: '/scm/purchasing', sort: 22, permissionCode: 'scm.purchase.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'oms-orders' }, update: { name: 'OMS 订单中心', path: '/oms/orders', sort: 21, permissionCode: 'oms.order.read' },
    create: { code: 'oms-orders', name: 'OMS 订单中心', path: '/oms/orders', sort: 21, permissionCode: 'oms.order.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'commercial-quotations' }, update: { name: '报价合同', path: '/commercial/quotations', sort: 20, permissionCode: 'commercial.quote.read' },
    create: { code: 'commercial-quotations', name: '报价合同', path: '/commercial/quotations', sort: 20, permissionCode: 'commercial.quote.read', type: MenuType.MENU },
  }));
  menus.push(await prisma.menu.upsert({
    where: { code: 'pim-products' }, update: { name: 'PIM 产品中心', path: '/pim/products', sort: 19, permissionCode: 'pim.product.read' },
    create: { code: 'pim-products', name: 'PIM 产品中心', path: '/pim/products', sort: 19, permissionCode: 'pim.product.read', type: MenuType.MENU },
  }));

  const adminRole = roles.get('ADMIN')!;
  await prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
  await prisma.roleMenu.createMany({ data: menus.map((m) => ({ roleId: adminRole.id, menuId: m.id })), skipDuplicates: true });

  const ownerRole = roles.get('OWNER')!;
  await prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })), skipDuplicates: true });
  await prisma.roleMenu.createMany({ data: menus.map((m) => ({ roleId: ownerRole.id, menuId: m.id })), skipDuplicates: true });

  const crmPermissions = permissions.filter((permission) => permission.code.startsWith('crm.'));
  const crmMenus = menus.filter((menu) => menu.code === 'crm' || menu.code.startsWith('crm-'));
  for (const roleCode of ['SALES', 'CUSTOMER_SERVICE']) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: crmPermissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: crmMenus.map((menu) => ({ roleId: role.id, menuId: menu.id })), skipDuplicates: true });
  }
  const projectPermissions = permissions.filter((permission) => permission.code.startsWith('project.'));
  const projectMenu = menus.find((menu) => menu.code === 'projects')!;
  for (const roleCode of ['SALES', 'INTERNAL_DESIGNER', 'PARTNER_DESIGNER', 'FACTORY_DIRECTOR']) {
    const role = roles.get(roleCode)!;
    const allowed = roleCode === 'FACTORY_DIRECTOR' ? projectPermissions.filter((permission) => permission.code === 'project.read') : projectPermissions;
    await prisma.rolePermission.createMany({ data: allowed.map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: projectMenu.id }], skipDuplicates: true });
  }
  const pimPermissions = permissions.filter((permission) => permission.code.startsWith('pim.'));
  const pimMenu = menus.find((menu) => menu.code === 'pim-products')!;
  const pimRolePermissions: Record<string, string[]> = {
    INTERNAL_DESIGNER: ['pim.product.read', 'pim.product.create', 'pim.product.update', 'pim.asset.manage'],
    SALES: ['pim.product.read'], CUSTOMER_SERVICE: ['pim.product.read'], PARTNER_DESIGNER: ['pim.product.read'],
    FACTORY_DIRECTOR: ['pim.product.read', 'pim.cost.read'], PURCHASING: ['pim.product.read', 'pim.cost.read'],
    FINANCE: ['pim.product.read', 'pim.cost.read'], WAREHOUSE: ['pim.product.read'], DEALER: ['pim.product.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(pimRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: pimPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: pimMenu.id }], skipDuplicates: true });
  }
  for (const [roleCode] of roleDefinitions) {
    const role = roles.get(roleCode)!;
    const canReadCost = ['OWNER', 'ADMIN', 'FACTORY_DIRECTOR', 'PURCHASING', 'FINANCE'].includes(roleCode);
    await prisma.fieldPermission.upsert({
      where: { roleId_resource_field: { roleId: role.id, resource: 'pim.product', field: 'factoryPrice' } },
      update: { canRead: canReadCost, canWrite: roleCode === 'OWNER' || roleCode === 'ADMIN' },
      create: { roleId: role.id, resource: 'pim.product', field: 'factoryPrice', canRead: canReadCost, canWrite: roleCode === 'OWNER' || roleCode === 'ADMIN' },
    });
    for (const field of ['employeeNo', 'phone', 'email', 'remark']) {
      const canManageUsers = roleCode === 'OWNER' || roleCode === 'ADMIN';
      await prisma.fieldPermission.upsert({
        where: { roleId_resource_field: { roleId: role.id, resource: 'system.user', field } },
        update: { canRead: canManageUsers, canWrite: canManageUsers },
        create: { roleId: role.id, resource: 'system.user', field, canRead: canManageUsers, canWrite: canManageUsers },
      });
    }
    for (const field of ['baseAmount', 'bonusAmount', 'deductionAmount', 'netAmount']) {
      const canManagePayroll = ['OWNER', 'ADMIN', 'FINANCE'].includes(roleCode);
      await prisma.fieldPermission.upsert({
        where: { roleId_resource_field: { roleId: role.id, resource: 'finance.payroll', field } },
        update: { canRead: canManagePayroll, canWrite: canManagePayroll },
        create: { roleId: role.id, resource: 'finance.payroll', field, canRead: canManagePayroll, canWrite: canManagePayroll },
      });
    }
  }
  const commercialPermissions = permissions.filter((permission) => permission.code.startsWith('commercial.'));
  const commercialMenu = menus.find((menu) => menu.code === 'commercial-quotations')!;
  const commercialRolePermissions: Record<string, string[]> = {
    SALES: ['commercial.quote.read', 'commercial.quote.create', 'commercial.quote.update', 'commercial.contract.read', 'commercial.contract.create', 'commercial.contract.update'],
    CUSTOMER_SERVICE: ['commercial.quote.read', 'commercial.contract.read'],
    INTERNAL_DESIGNER: ['commercial.quote.read'], PARTNER_DESIGNER: ['commercial.quote.read'],
    FINANCE: ['commercial.quote.read', 'commercial.quote.approve', 'commercial.contract.read', 'commercial.contract.update'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(commercialRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: commercialPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: commercialMenu.id }], skipDuplicates: true });
  }
  const omsPermissions = permissions.filter((permission) => permission.code.startsWith('oms.'));
  const omsMenu = menus.find((menu) => menu.code === 'oms-orders')!;
  const omsRolePermissions: Record<string, string[]> = {
    SALES: ['oms.order.read', 'oms.order.create', 'oms.order.update', 'oms.order.confirm'],
    CUSTOMER_SERVICE: ['oms.order.read'], FACTORY_DIRECTOR: ['oms.order.read', 'oms.order.update'],
    WAREHOUSE: ['oms.order.read'], FINANCE: ['oms.order.read'], INSTALLER: ['oms.order.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(omsRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: omsPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: omsMenu.id }], skipDuplicates: true });
  }
  const scmPermissions = permissions.filter((permission) => permission.code.startsWith('scm.'));
  const scmMenu = menus.find((menu) => menu.code === 'scm-purchasing')!;
  const scmRolePermissions: Record<string, string[]> = {
    PURCHASING: ['scm.supplier.read', 'scm.supplier.manage', 'scm.purchase.read', 'scm.purchase.create', 'scm.purchase.update', 'scm.purchase.receive'],
    FINANCE: ['scm.supplier.read', 'scm.purchase.read', 'scm.purchase.approve'],
    WAREHOUSE: ['scm.supplier.read', 'scm.purchase.read', 'scm.purchase.receive'], FACTORY_DIRECTOR: ['scm.supplier.read', 'scm.purchase.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(scmRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: scmPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: scmMenu.id }], skipDuplicates: true });
  }
  const mesPermissions = permissions.filter((permission) => permission.code.startsWith('mes.'));
  const mesMenu = menus.find((menu) => menu.code === 'mes-production')!;
  const mesRolePermissions: Record<string, string[]> = {
    FACTORY_DIRECTOR: mesPermissions.map((permission) => permission.code),
    WORKER: ['mes.production.read', 'mes.workorder.read', 'mes.workorder.report'],
    QUALITY_INSPECTOR: ['mes.production.read', 'mes.workorder.read'], INTERNAL_DESIGNER: ['mes.production.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(mesRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: mesPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: mesMenu.id }], skipDuplicates: true });
  }
  const wmsPermissions = permissions.filter((permission) => permission.code.startsWith('wms.'));
  const wmsMenu = menus.find((menu) => menu.code === 'wms-inventory')!;
  const wmsRolePermissions: Record<string, string[]> = {
    WAREHOUSE: wmsPermissions.map((permission) => permission.code),
    FACTORY_DIRECTOR: ['wms.warehouse.read', 'wms.inventory.read', 'wms.stock.receive', 'wms.stock.issue', 'wms.stock.transfer'],
    PURCHASING: ['wms.warehouse.read', 'wms.inventory.read', 'wms.stock.receive'],
    FINANCE: ['wms.warehouse.read', 'wms.inventory.read'],
    QUALITY_INSPECTOR: ['wms.warehouse.read', 'wms.inventory.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(wmsRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: wmsPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: wmsMenu.id }], skipDuplicates: true });
  }
  const financePermissions = permissions.filter((permission) => permission.code.startsWith('finance.'));
  const financeMenu = menus.find((menu) => menu.code === 'finance-center')!;
  const financeRolePermissions: Record<string, string[]> = {
    FINANCE: financePermissions.map((permission) => permission.code),
    SALES: ['finance.dashboard.read', 'finance.receivable.read'],
    CUSTOMER_SERVICE: ['finance.receivable.read'],
    PURCHASING: ['finance.payable.read'],
    FACTORY_DIRECTOR: ['finance.dashboard.read', 'finance.expense.read', 'finance.expense.create'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(financeRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: financePermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: financeMenu.id }], skipDuplicates: true });
  }
  const fulfillmentPermissions = permissions.filter((permission) => permission.code.startsWith('fulfillment.'));
  const fulfillmentMenu = menus.find((menu) => menu.code === 'fulfillment-center')!;
  const fulfillmentRolePermissions: Record<string, string[]> = {
    WAREHOUSE: ['fulfillment.shipment.read', 'fulfillment.shipment.create', 'fulfillment.shipment.dispatch'],
    INSTALLER: ['fulfillment.shipment.read', 'fulfillment.shipment.deliver', 'fulfillment.installation.read', 'fulfillment.installation.report', 'fulfillment.aftersales.read', 'fulfillment.aftersales.manage'],
    CUSTOMER_SERVICE: ['fulfillment.shipment.read', 'fulfillment.installation.read', 'fulfillment.aftersales.read', 'fulfillment.aftersales.create', 'fulfillment.aftersales.manage'],
    SALES: ['fulfillment.shipment.read', 'fulfillment.installation.read', 'fulfillment.aftersales.read', 'fulfillment.aftersales.create'],
    FACTORY_DIRECTOR: fulfillmentPermissions.map((permission) => permission.code),
  };
  for (const [roleCode, allowedCodes] of Object.entries(fulfillmentRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: fulfillmentPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: fulfillmentMenu.id }], skipDuplicates: true });
  }
  const taskPermissions = permissions.filter((permission) => permission.code.startsWith('task.') || permission.code.startsWith('alert.'));
  const taskMenu = menus.find((menu) => menu.code === 'task-alert-center')!;
  const taskRolePermissions: Record<string, string[]> = {
    FACTORY_DIRECTOR: taskPermissions.map((permission) => permission.code),
    SALES: ['task.read', 'task.create', 'task.manage', 'alert.read'],
    CUSTOMER_SERVICE: ['task.read', 'task.create', 'task.manage', 'alert.read', 'alert.manage'],
    INTERNAL_DESIGNER: ['task.read', 'task.create', 'task.manage', 'alert.read'],
    PARTNER_DESIGNER: ['task.read', 'task.create', 'task.manage'],
    WORKER: ['task.read', 'task.create', 'task.manage'],
    QUALITY_INSPECTOR: ['task.read', 'task.create', 'task.manage', 'alert.read', 'alert.manage'],
    WAREHOUSE: ['task.read', 'task.create', 'task.manage', 'alert.read', 'alert.manage'],
    FINANCE: ['task.read', 'task.create', 'task.manage', 'alert.read', 'alert.scan', 'alert.manage'],
    PURCHASING: ['task.read', 'task.create', 'task.manage', 'alert.read'],
    INSTALLER: ['task.read', 'task.create', 'task.manage', 'alert.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(taskRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: taskPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: taskMenu.id }], skipDuplicates: true });
  }
  const analyticsPermissions = permissions.filter((permission) => permission.code.startsWith('analytics.') || permission.code.startsWith('ai.'));
  const analyticsMenu = menus.find((menu) => menu.code === 'analytics-center')!;
  const analyticsRolePermissions: Record<string, string[]> = {
    FACTORY_DIRECTOR: analyticsPermissions.map((permission) => permission.code),
    FINANCE: analyticsPermissions.map((permission) => permission.code),
    SALES: ['analytics.dashboard.read', 'ai.insight.read'],
    CUSTOMER_SERVICE: ['analytics.dashboard.read', 'ai.insight.read'],
    INTERNAL_DESIGNER: ['analytics.dashboard.read', 'ai.insight.read'],
    WAREHOUSE: ['analytics.dashboard.read', 'ai.insight.read'],
    PURCHASING: ['analytics.dashboard.read', 'ai.insight.read'],
  };
  for (const [roleCode, allowedCodes] of Object.entries(analyticsRolePermissions)) {
    const role = roles.get(roleCode)!;
    await prisma.rolePermission.createMany({ data: analyticsPermissions.filter((permission) => allowedCodes.includes(permission.code)).map((permission) => ({ roleId: role.id, permissionId: permission.id })), skipDuplicates: true });
    await prisma.roleMenu.createMany({ data: [{ roleId: role.id, menuId: analyticsMenu.id }], skipDuplicates: true });
  }
  const integrationPermissions = permissions.filter((permission) => permission.code.startsWith('integration.'));
  const integrationMenu = menus.find((menu) => menu.code === 'integration-center')!;
  const factoryDirector = roles.get('FACTORY_DIRECTOR')!;
  await prisma.rolePermission.createMany({ data: integrationPermissions.filter((permission) => permission.code === 'integration.read').map((permission) => ({ roleId: factoryDirector.id, permissionId: permission.id })), skipDuplicates: true });
  await prisma.roleMenu.createMany({ data: [{ roleId: factoryDirector.id, menuId: integrationMenu.id }], skipDuplicates: true });

  const passwordHash = await hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: organization.id, username: 'admin' } },
    update: {},
    create: { organizationId: organization.id, username: 'admin', displayName: '系统管理员', passwordHash, mustChangePassword: !isLocalDatabase, passwordChangedAt: new Date() },
  });
  await prisma.userRole.createMany({ data: [{ userId: admin.id, roleId: adminRole.id }, { userId: admin.id, roleId: ownerRole.id }], skipDuplicates: true });
  await prisma.userOrgUnit.upsert({ where: { userId_orgUnitId: { userId: admin.id, orgUnitId: company.id } }, update: { isPrimary: true }, create: { userId: admin.id, orgUnitId: company.id, isPrimary: true } });
  for (const [type, name] of [['WEBSITE', '品牌官网'], ['WECHAT_MINI_PROGRAM', '微信小程序'], ['TAOBAO', '淘宝店铺'], ['WECOM', '企业微信'], ['DESIGNER_PORTAL', '设计师中心'], ['DEALER_PORTAL', '经销商中心']] as const) {
    await prisma.integrationChannel.upsert({ where: { organizationId_type: { organizationId: organization.id, type } }, update: { name }, create: { organizationId: organization.id, type, name, status: 'INACTIVE', config: { reserved: true }, createdById: admin.id } });
  }

  const salesPasswordHash = await hash(demoPassword('Sales123!'), 12);
  const salesUser = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: organization.id, username: 'sales01' } },
    update: {},
    create: { organizationId: organization.id, username: 'sales01', displayName: '演示销售', phone: '13800009999', passwordHash: salesPasswordHash, status: demoStatus, mustChangePassword: !isLocalDatabase, passwordChangedAt: new Date() },
  });
  await prisma.userRole.createMany({ data: [{ userId: salesUser.id, roleId: roles.get('SALES')!.id }], skipDuplicates: true });
  const workerPasswordHash = await hash(demoPassword('Worker123!'), 12);
  const workerUser = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: organization.id, username: 'worker01' } }, update: {},
    create: { organizationId: organization.id, username: 'worker01', displayName: '演示木工师傅', phone: '13800007701', passwordHash: workerPasswordHash, status: demoStatus, mustChangePassword: !isLocalDatabase, passwordChangedAt: new Date() },
  });
  await prisma.userRole.createMany({ data: [{ userId: workerUser.id, roleId: roles.get('WORKER')!.id }], skipDuplicates: true });
  const factoryUnit = await prisma.orgUnit.findUniqueOrThrow({ where: { organizationId_code: { organizationId: organization.id, code: 'FACTORY' } } });
  await prisma.userOrgUnit.upsert({ where: { userId_orgUnitId: { userId: workerUser.id, orgUnitId: factoryUnit.id } }, update: { isPrimary: true }, create: { userId: workerUser.id, orgUnitId: factoryUnit.id, isPrimary: true } });
  const warehousePasswordHash = await hash(demoPassword('Warehouse123!'), 12);
  const warehouseUser = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: organization.id, username: 'warehouse01' } }, update: {},
    create: { organizationId: organization.id, username: 'warehouse01', displayName: '演示仓管员', phone: '13800007702', passwordHash: warehousePasswordHash, status: demoStatus, mustChangePassword: !isLocalDatabase, passwordChangedAt: new Date() },
  });
  await prisma.userRole.createMany({ data: [{ userId: warehouseUser.id, roleId: roles.get('WAREHOUSE')!.id }], skipDuplicates: true });
  await prisma.userOrgUnit.upsert({ where: { userId_orgUnitId: { userId: warehouseUser.id, orgUnitId: factoryUnit.id } }, update: { isPrimary: true }, create: { userId: warehouseUser.id, orgUnitId: factoryUnit.id, isPrimary: true } });
  const financePasswordHash = await hash(demoPassword('Finance123!'), 12);
  const financeUser = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: organization.id, username: 'finance01' } }, update: {},
    create: { organizationId: organization.id, username: 'finance01', displayName: '演示财务', phone: '13800007703', passwordHash: financePasswordHash, status: demoStatus, mustChangePassword: !isLocalDatabase, passwordChangedAt: new Date() },
  });
  await prisma.userRole.createMany({ data: [{ userId: financeUser.id, roleId: roles.get('FINANCE')!.id }], skipDuplicates: true });
  const financeUnit = await prisma.orgUnit.findUniqueOrThrow({ where: { organizationId_code: { organizationId: organization.id, code: 'FINANCE' } } });
  await prisma.userOrgUnit.upsert({ where: { userId_orgUnitId: { userId: financeUser.id, orgUnitId: financeUnit.id } }, update: { isPrimary: true }, create: { userId: financeUser.id, orgUnitId: financeUnit.id, isPrimary: true } });
  const installerPasswordHash = await hash(demoPassword('Installer123!'), 12);
  const installerUser = await prisma.user.upsert({
    where: { organizationId_username: { organizationId: organization.id, username: 'installer01' } }, update: {},
    create: { organizationId: organization.id, username: 'installer01', displayName: '演示物流安装师傅', phone: '13800007704', passwordHash: installerPasswordHash, status: demoStatus, mustChangePassword: !isLocalDatabase, passwordChangedAt: new Date() },
  });
  await prisma.userRole.createMany({ data: [{ userId: installerUser.id, roleId: roles.get('INSTALLER')!.id }], skipDuplicates: true });
  await prisma.userOrgUnit.upsert({ where: { userId_orgUnitId: { userId: installerUser.id, orgUnitId: factoryUnit.id } }, update: { isPrimary: true }, create: { userId: installerUser.id, orgUnitId: factoryUnit.id, isPrimary: true } });

  for (const [code, name, prefix] of [['CUSTOMER', '客户编号', 'CU'], ['LEAD', '线索编号', 'LD'], ['PROJECT', '项目编号', 'PJ'], ['PRODUCT', '产品编号', 'PR'], ['QUOTATION', '报价单编号', 'QT'], ['CONTRACT', '合同编号', 'CT'], ['ORDER', '订单编号', 'SO'], ['SUPPLIER', '供应商编号', 'SP'], ['PURCHASE_ORDER', '采购单编号', 'PO'], ['PRODUCTION_ORDER', '生产订单编号', 'MO'], ['WORK_ORDER', '工单编号', 'WO'], ['INVENTORY_TRANSACTION', '库存流水编号', 'IT'], ['RECEIVABLE', '应收单编号', 'AR'], ['RECEIPT', '收款单编号', 'RC'], ['PAYABLE', '应付单编号', 'AP'], ['PAYMENT', '付款单编号', 'PM'], ['EXPENSE', '费用单编号', 'EX'], ['PAYROLL', '工资单编号', 'PY'], ['SHIPMENT', '配送单编号', 'SH'], ['INSTALLATION', '安装单编号', 'IN'], ['AFTER_SALES', '售后单编号', 'AS'], ['TASK', '任务编号', 'TK']] as const) {
    await prisma.businessNumberRule.upsert({ where: { organizationId_code: { organizationId: organization.id, code } }, update: {}, create: { organizationId: organization.id, code, name, prefix } });
  }

  const dict = await prisma.dictionary.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'COMMON_STATUS' } }, update: {},
    create: { organizationId: organization.id, code: 'COMMON_STATUS', name: '通用状态' },
  });
  await prisma.dictionaryItem.createMany({ data: [
    { dictionaryId: dict.id, value: 'ACTIVE', label: '启用', sort: 10 },
    { dictionaryId: dict.id, value: 'DISABLED', label: '停用', sort: 20 },
  ], skipDuplicates: true });

  const salesUnit = await prisma.orgUnit.findUniqueOrThrow({ where: { organizationId_code: { organizationId: organization.id, code: 'SALES' } } });
  await prisma.userOrgUnit.upsert({ where: { userId_orgUnitId: { userId: salesUser.id, orgUnitId: salesUnit.id } }, update: { isPrimary: true }, create: { userId: salesUser.id, orgUnitId: salesUnit.id, isPrimary: true } });
  const demoCustomer = await prisma.customer.upsert({
    where: { organizationId_customerNo: { organizationId: organization.id, customerNo: 'CU-DEMO-001' } },
    update: {}, create: {
      organizationId: organization.id, customerNo: 'CU-DEMO-001', type: 'COMPANY', status: 'ACTIVE',
      name: '上海木语空间设计有限公司', shortName: '木语空间', phone: '13800000001', source: '合作设计师推荐',
      level: 'A', province: '上海市', city: '上海市', tags: ['高端住宅', '设计师渠道'],
      ownerId: admin.id, orgUnitId: salesUnit.id, createdById: admin.id,
    },
  });
  const contactExists = await prisma.customerContact.findFirst({ where: { customerId: demoCustomer.id, phone: '13800000001' } });
  if (!contactExists) await prisma.customerContact.create({ data: { customerId: demoCustomer.id, name: '林女士', title: '主案设计师', phone: '13800000001', isPrimary: true } });
  await prisma.customer.upsert({
    where: { organizationId_customerNo: { organizationId: organization.id, customerNo: 'CU-DEMO-002' } }, update: {},
    create: {
      organizationId: organization.id, customerNo: 'CU-DEMO-002', type: 'INDIVIDUAL', status: 'PROSPECT', name: '演示销售名下客户',
      phone: '13800000003', source: '门店到访', level: 'B', tags: ['零售'], ownerId: salesUser.id, orgUnitId: salesUnit.id, createdById: admin.id,
    },
  });
  await prisma.lead.upsert({
    where: { organizationId_leadNo: { organizationId: organization.id, leadNo: 'LD-DEMO-001' } }, update: {},
    create: {
      organizationId: organization.id, leadNo: 'LD-DEMO-001', name: '杭州湖畔别墅全屋项目', contactName: '周先生',
      phone: '13800000002', source: '官网咨询', status: 'QUALIFYING', intentSummary: '关注胡桃木全屋定制，待首次上门量房',
      estimatedValue: 280000, nextFollowUpAt: new Date(Date.now() + 86400000), ownerId: admin.id, orgUnitId: salesUnit.id, createdById: admin.id,
    },
  });
  const demoProject = await prisma.project.upsert({
    where: { organizationId_projectNo: { organizationId: organization.id, projectNo: 'PJ-DEMO-001' } }, update: {},
    create: {
      organizationId: organization.id, projectNo: 'PJ-DEMO-001', customerId: demoCustomer.id, name: '木语空间 · 浦东顶层住宅',
      status: 'DESIGNING', address: '上海市浦东新区', estimatedBudget: 680000, expectedDeliveryAt: new Date(Date.now() + 90 * 86400000),
      ownerId: admin.id, orgUnitId: salesUnit.id, createdById: admin.id, tags: ['全屋定制', '胡桃木'], notes: '已完成初尺，等待平面方案确认。',
    },
  });
  await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: demoProject.id, userId: admin.id } }, update: { role: 'MANAGER' }, create: { projectId: demoProject.id, userId: admin.id, role: 'MANAGER' } });
  const demoSpace = await prisma.projectSpace.findFirst({ where: { projectId: demoProject.id, name: '客餐厅' } });
  if (!demoSpace) await prisma.projectSpace.create({ data: { projectId: demoProject.id, name: '客餐厅', roomType: '公共空间', floor: '1F', lengthMm: 8600, widthMm: 5200, heightMm: 3000, areaSqm: 44.72, sort: 10 } });
  await prisma.designVersion.upsert({ where: { projectId_versionNo: { projectId: demoProject.id, versionNo: 1 } }, update: {}, create: { projectId: demoProject.id, versionNo: 1, title: '平面布局方案 V1', status: 'INTERNAL_REVIEW', description: '首轮平面布局，含客餐厅与主卧动线。', createdById: admin.id } });

  const finishedCategory = await prisma.productCategory.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'FINISHED_FURNITURE' } },
    update: { name: '成品家具' }, create: { organizationId: organization.id, code: 'FINISHED_FURNITURE', name: '成品家具', sort: 10 },
  });
  const chairCategory = await prisma.productCategory.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'CHAIR' } },
    update: { name: '座椅', parentId: finishedCategory.id },
    create: { organizationId: organization.id, parentId: finishedCategory.id, code: 'CHAIR', name: '座椅', sort: 10 },
  });
  const productTemplates = [
    { code: 'HQT-SOLID-WOOD-CHAIR-V3', name: '实木座椅标准模板', categoryCode: 'CHAIR', categoryName: '座椅', summary: '适用于圈椅、餐椅和休闲椅，包含标准尺寸、材质与渠道标题规则。', defaults: { brand: '怀趣堂', collection: '东方雅居', materialNameCn: '缅甸柚木', materialNameEn: 'Myanmar Teak', color: '怀趣堂暖金棕', unit: '件', priceMultiplier: 1.5, tags: ['实木家具', '缅甸柚木', '座椅'], description: '产品结构、比例、木纹与颜色须保持一致；下游素材统一使用已验收白底图。' }, skuBlueprints: [{ suffix: 'STD', name: '标准款', attributes: { edition: '标准款', finish: '暖金棕' }, lengthMm: 680, widthMm: 600, heightMm: 820 }], channelMappings: { taobao: { itemType: 'fixed', titlePattern: '{brand} {material} {name}' }, wechatMiniProgram: { category: '家具/椅凳', deliveryType: 'merchant' } } },
    { code: 'HQT-LIVE-EDGE-SLAB-TABLE-V1', name: '实木大板桌模板', categoryCode: 'SLAB_TABLE', categoryName: '实木大板', summary: '适用于原木大板餐桌、会议桌、茶桌，规格以长宽厚和桌脚组合管理。', defaults: { brand: '怀趣堂', collection: '原木大板', materialNameCn: '缅甸柚木', materialNameEn: 'Myanmar Teak', color: '自然暖金棕', unit: '张', priceMultiplier: 1.5, tags: ['实木大板', '原木整板', '可选桌脚'], description: '天然边、木纹、结疤与尺寸以实物编号为准；每张大板须绑定独立白底图和尺寸照片。' }, skuBlueprints: [{ suffix: '1800', name: '约 1800 mm 大板', attributes: { edge: '天然边', legs: '可选桌脚', thickness: '约 80 mm' }, lengthMm: 1800, widthMm: 800, heightMm: 750 }, { suffix: '2200', name: '约 2200 mm 大板', attributes: { edge: '天然边', legs: '可选桌脚', thickness: '约 80 mm' }, lengthMm: 2200, widthMm: 900, heightMm: 750 }], channelMappings: { taobao: { itemType: 'unique_slab', titlePattern: '{material} 实木大板 {length}mm 一板一图' }, wechatMiniProgram: { category: '家具/桌几/实木大板', uniqueInventory: true } } },
    { code: 'HQT-DINING-TABLE-V1', name: '实木餐桌标准模板', categoryCode: 'DINING_TABLE', categoryName: '餐桌', summary: '适用于四人至八人实木餐桌，按长度和饰面形成 SKU。', defaults: { brand: '怀趣堂', collection: '东方雅居', materialNameCn: '黑胡桃木', materialNameEn: 'Black Walnut', color: '自然木色', unit: '张', priceMultiplier: 1.5, tags: ['实木餐桌', '家庭餐厅'], description: '标准餐桌模板；发布前确认桌面结构、桌脚形式、承重和安装方式。' }, skuBlueprints: [{ suffix: '1600', name: '四至六人款', attributes: { seats: '4-6人' }, lengthMm: 1600, widthMm: 800, heightMm: 750 }, { suffix: '2000', name: '六至八人款', attributes: { seats: '6-8人' }, lengthMm: 2000, widthMm: 900, heightMm: 750 }], channelMappings: { taobao: { itemType: 'fixed', titlePattern: '{brand} 黑胡桃实木餐桌 {length}mm' }, wechatMiniProgram: { category: '家具/桌几/餐桌' } } },
    { code: 'HQT-TEA-TABLE-V1', name: '实木茶桌模板', categoryCode: 'TEA_TABLE', categoryName: '茶桌', summary: '适用于中式茶桌、泡茶桌与茶空间套组。', defaults: { brand: '怀趣堂', collection: '茶叙', materialNameCn: '缅甸柚木', materialNameEn: 'Myanmar Teak', color: '怀趣堂暖金棕', unit: '套', priceMultiplier: 1.5, tags: ['茶桌', '茶空间', '实木家具'], description: '茶桌主商品与配套椅凳分 SKU 描述，渠道载荷不得混入工厂价。' }, skuBlueprints: [{ suffix: 'MAIN', name: '主桌标准款', attributes: { set: '主桌' }, lengthMm: 1800, widthMm: 780, heightMm: 720 }], channelMappings: { taobao: { itemType: 'fixed', titlePattern: '{brand} {material}实木茶桌' }, wechatMiniProgram: { category: '家具/桌几/茶桌' } } },
    { code: 'HQT-SOLID-WOOD-BED-V1', name: '实木床标准模板', categoryCode: 'BED', categoryName: '床', summary: '适用于 1.5 米、1.8 米实木床，预置床垫尺寸和安装属性。', defaults: { brand: '怀趣堂', collection: '静栖', materialNameCn: '北美黑胡桃木', materialNameEn: 'American Black Walnut', color: '自然木色', unit: '张', priceMultiplier: 1.5, tags: ['实木床', '卧室家具'], description: '床体外尺寸与床垫适配尺寸须分别标注；正式发布前确认五金、排骨架与安装说明。' }, skuBlueprints: [{ suffix: '1500', name: '适配 1500×2000 床垫', attributes: { mattress: '1500×2000 mm' }, lengthMm: 2100, widthMm: 1580, heightMm: 980 }, { suffix: '1800', name: '适配 1800×2000 床垫', attributes: { mattress: '1800×2000 mm' }, lengthMm: 2100, widthMm: 1880, heightMm: 980 }], channelMappings: { taobao: { itemType: 'fixed', titlePattern: '{brand} 黑胡桃实木床' }, wechatMiniProgram: { category: '家具/卧室/床' } } },
    { code: 'HQT-STORAGE-CABINET-V1', name: '实木柜体标准模板', categoryCode: 'CABINET', categoryName: '柜类', summary: '适用于餐边柜、书柜、电视柜，预置门板、抽屉和安装字段。', defaults: { brand: '怀趣堂', collection: '有容', materialNameCn: '北美黑胡桃木', materialNameEn: 'American Black Walnut', color: '自然木色', unit: '件', priceMultiplier: 1.5, tags: ['实木柜', '收纳家具'], description: '柜体模板；发布前补全层板、五金、靠墙固定和入户尺寸说明。' }, skuBlueprints: [{ suffix: 'STD', name: '标准柜体', attributes: { hardware: '缓冲五金', installation: '整装/需固定' }, lengthMm: 1600, widthMm: 420, heightMm: 820 }], channelMappings: { taobao: { itemType: 'fixed', titlePattern: '{brand} 黑胡桃实木收纳柜' }, wechatMiniProgram: { category: '家具/柜架' } } },
  ] as const;
  const templateRecords = new Map<string, { id: string }>();
  for (const template of productTemplates) {
    const record = await prisma.productTemplate.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: template.code } },
      update: { name: template.name, categoryName: template.categoryName, summary: template.summary, defaults: template.defaults, skuBlueprints: [...template.skuBlueprints], channelMappings: template.channelMappings, active: true },
      create: { organizationId: organization.id, ...template, productType: 'FINISHED_GOOD', assetChecklist: ['800×800 白底主图', '详情图', '尺寸图', '材质特写', '包装与安装说明'], createdById: admin.id },
      select: { id: true },
    });
    templateRecords.set(template.code, record);
  }
  const demoProduct = await prisma.product.upsert({
    where: { organizationId_productNo: { organizationId: organization.id, productNo: 'HQT-CATALOG-CHAIR-001' } },
    update: { sourceTemplateId: templateRecords.get('HQT-SOLID-WOOD-CHAIR-V3')!.id }, create: {
      organizationId: organization.id, productNo: 'HQT-CATALOG-CHAIR-001', type: 'FINISHED_GOOD', status: 'ACTIVE',
      categoryId: chairCategory.id, sourceTemplateId: templateRecords.get('HQT-SOLID-WOOD-CHAIR-V3')!.id, name: '缅甸柚木圈椅', shortName: '柚木圈椅', brand: '怀趣堂', collection: '东方雅居',
      materialNameCn: '缅甸柚木', materialNameEn: 'Myanmar Teak', color: '怀趣堂暖金棕',
      lengthMm: 680, widthMm: 600, heightMm: 820, unit: '件', factoryPrice: 8800, retailPrice: 13200,
      priceMultiplier: 1.5, currency: 'CNY', publicVisible: true, tags: ['实木家具', '缅甸柚木', '圈椅'],
      description: '正式产品母版。产品结构、比例、木纹与颜色须保持一致；下游素材统一使用已验收白底图。',
      createdById: admin.id, updatedById: admin.id,
    },
  });
  const demoSku = await prisma.productSku.upsert({
    where: { productId_skuCode: { productId: demoProduct.id, skuCode: 'HQT-CHAIR-001-STD' } },
    update: {}, create: {
      productId: demoProduct.id, skuCode: 'HQT-CHAIR-001-STD', name: '缅甸柚木圈椅 · 标准款', isDefault: true,
      attributes: { wood: 'Myanmar Teak', finish: '暖金棕', edition: '标准款' }, lengthMm: 680, widthMm: 600, heightMm: 820,
      factoryPrice: 8800, retailPrice: 13200,
    },
  });
  const demoQuotation = await prisma.quotation.upsert({
    where: { organizationId_quotationNo: { organizationId: organization.id, quotationNo: 'QT-DEMO-001' } },
    update: {}, create: {
      organizationId: organization.id, quotationNo: 'QT-DEMO-001', customerId: demoCustomer.id, projectId: demoProject.id,
      title: '浦东顶层住宅首轮家具报价', status: 'APPROVED', subtotal: 26400, totalAmount: 26400,
      validUntil: new Date(Date.now() + 30 * 86400000), notes: '演示报价单，价格来自 PIM 建议零售价。',
      terms: '报价有效期 30 天；生产前按合同约定支付定金。', ownerId: admin.id, createdById: admin.id, approvedById: admin.id, approvedAt: new Date(),
    },
  });
  await prisma.quotationItem.upsert({
    where: { quotationId_lineNo: { quotationId: demoQuotation.id, lineNo: 1 } }, update: { materialName: '缅甸柚木', notes: '标准款，颜色为怀趣堂暖金棕。' },
    create: { quotationId: demoQuotation.id, lineNo: 1, productId: demoProduct.id, description: '缅甸柚木圈椅', materialName: '缅甸柚木', specification: '标准款 / 暖金棕', notes: '标准款，颜色为怀趣堂暖金棕。', quantity: 2, unit: '件', unitPrice: 13200, amount: 26400, sort: 10 },
  });
  const demoContract = await prisma.contract.upsert({
    where: { organizationId_contractNo: { organizationId: organization.id, contractNo: 'CT-DEMO-001' } },
    update: { status: 'ACTIVE' }, create: {
      organizationId: organization.id, contractNo: 'CT-DEMO-001', quotationId: demoQuotation.id, customerId: demoCustomer.id,
      projectId: demoProject.id, title: '浦东顶层住宅家具合同', status: 'ACTIVE', totalAmount: 26400, depositAmount: 8000,
      signedAt: new Date(), effectiveAt: new Date(), terms: demoQuotation.terms, createdById: admin.id,
    },
  });
  await prisma.quotation.update({ where: { id: demoQuotation.id }, data: { status: 'CONVERTED' } });
  const demoOrder = await prisma.salesOrder.upsert({
    where: { organizationId_orderNo: { organizationId: organization.id, orderNo: 'SO-DEMO-001' } }, update: {},
    create: {
      organizationId: organization.id, orderNo: 'SO-DEMO-001', contractId: demoContract.id, customerId: demoCustomer.id, projectId: demoProject.id,
      title: '浦东顶层住宅家具订单', status: 'CONFIRMED', totalAmount: 26400, paidAmount: 8000, paymentStatus: 'PARTIALLY_PAID',
      deliveryAddress: '上海市浦东新区', expectedDeliveryAt: new Date(Date.now() + 75 * 86400000), confirmedAt: new Date(),
      ownerId: admin.id, createdById: admin.id, notes: '由演示合同生成。',
    },
  });
  await prisma.salesOrderItem.upsert({
    where: { salesOrderId_lineNo: { salesOrderId: demoOrder.id, lineNo: 1 } }, update: {},
    create: { salesOrderId: demoOrder.id, lineNo: 1, productId: demoProduct.id, description: '缅甸柚木圈椅', specification: '标准款 / 暖金棕', quantity: 2, unit: '件', unitPrice: 13200, amount: 26400, sort: 10 },
  });
  const materialProduct = await prisma.product.upsert({
    where: { organizationId_productNo: { organizationId: organization.id, productNo: 'MAT-DEMO-TEAK-001' } }, update: {},
    create: { organizationId: organization.id, productNo: 'MAT-DEMO-TEAK-001', type: 'MATERIAL', status: 'ACTIVE', name: '缅甸柚木烘干板材', materialNameCn: '缅甸柚木', materialNameEn: 'Myanmar Teak', color: '自然暖金棕', unit: 'm³', factoryPrice: 18500, retailPrice: 27750, publicVisible: false, createdById: admin.id, updatedById: admin.id, tags: ['原材料', '实木板材'] },
  });
  const demoSupplier = await prisma.supplier.upsert({
    where: { organizationId_supplierNo: { organizationId: organization.id, supplierNo: 'SP-DEMO-001' } }, update: {},
    create: { organizationId: organization.id, supplierNo: 'SP-DEMO-001', name: '云南森源木业有限公司', shortName: '森源木业', contactName: '陈经理', phone: '13800008001', paymentTerms: '月结 30 天', leadDays: 15, rating: 4.8, categories: ['缅甸柚木', '实木板材'], createdById: admin.id },
  });
  const demoPurchase = await prisma.purchaseOrder.upsert({
    where: { organizationId_purchaseOrderNo: { organizationId: organization.id, purchaseOrderNo: 'PO-DEMO-001' } }, update: {},
    create: { organizationId: organization.id, purchaseOrderNo: 'PO-DEMO-001', supplierId: demoSupplier.id, salesOrderId: demoOrder.id, status: 'PARTIALLY_RECEIVED', subtotal: 46250, taxAmount: 6012.5, totalAmount: 52262.5, expectedArrivalAt: new Date(Date.now() + 10 * 86400000), orderedAt: new Date(), notes: '演示板材采购，已分批到货。', buyerId: admin.id, createdById: admin.id, approvedById: admin.id, approvedAt: new Date() },
  });
  await prisma.purchaseOrderItem.upsert({
    where: { purchaseOrderId_lineNo: { purchaseOrderId: demoPurchase.id, lineNo: 1 } }, update: {},
    create: { purchaseOrderId: demoPurchase.id, lineNo: 1, productId: materialProduct.id, description: '缅甸柚木烘干板材', specification: 'A级 / 含水率 8%-12%', quantity: 2.5, receivedQuantity: 1, unit: 'm³', unitPrice: 18500, taxRate: 0.13, amount: 46250, sort: 10 },
  });
  const demoOrderItem = await prisma.salesOrderItem.findUniqueOrThrow({ where: { salesOrderId_lineNo: { salesOrderId: demoOrder.id, lineNo: 1 } } });
  const demoProduction = await prisma.productionOrder.upsert({
    where: { organizationId_productionOrderNo: { organizationId: organization.id, productionOrderNo: 'MO-DEMO-001' } }, update: {},
    create: { organizationId: organization.id, productionOrderNo: 'MO-DEMO-001', salesOrderId: demoOrder.id, status: 'RELEASED', priority: 70, plannedStartAt: new Date(), plannedEndAt: new Date(Date.now() + 45 * 86400000), notes: '演示家具标准工艺路线。', createdById: admin.id },
  });
  const demoProductionItem = await prisma.productionOrderItem.upsert({
    where: { salesOrderItemId: demoOrderItem.id }, update: {}, create: { productionOrderId: demoProduction.id, salesOrderItemId: demoOrderItem.id, productId: demoOrderItem.productId, skuId: demoOrderItem.skuId, description: demoOrderItem.description, specification: demoOrderItem.specification, plannedQuantity: demoOrderItem.quantity, unit: demoOrderItem.unit, sort: 10 },
  });
  for (const [sequence, code, name, workstation] of [[10, 'CUTTING', '开料', '开料区'], [20, 'WOODWORK', '木工', '木工区'], [30, 'SANDING', '打磨', '打磨区'], [40, 'FINISHING', '涂装', '涂装区']] as const) {
    await prisma.workOrder.upsert({ where: { productionOrderItemId_sequence: { productionOrderItemId: demoProductionItem.id, sequence } }, update: {}, create: { organizationId: organization.id, workOrderNo: `WO-DEMO-001-${sequence}`, productionOrderId: demoProduction.id, productionOrderItemId: demoProductionItem.id, operationCode: code, operationName: name, sequence, status: sequence === 10 ? 'READY' : 'PENDING', workstation, assignedToId: sequence <= 30 ? workerUser.id : null, plannedQuantity: demoProductionItem.plannedQuantity, createdById: admin.id } });
  }

  const mainWarehouse = await prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'MAIN' } },
    update: { name: '家具工厂主仓' },
    create: { organizationId: organization.id, code: 'MAIN', name: '家具工厂主仓', type: 'MIXED', address: '生产基地一号仓', createdById: admin.id },
  });
  const rawLocation = await prisma.stockLocation.upsert({ where: { warehouseId_code: { warehouseId: mainWarehouse.id, code: 'RAW-A01' } }, update: {}, create: { warehouseId: mainWarehouse.id, code: 'RAW-A01', name: '原料 A01', zone: '原料区' } });
  const finishedLocation = await prisma.stockLocation.upsert({ where: { warehouseId_code: { warehouseId: mainWarehouse.id, code: 'FG-A01' } }, update: {}, create: { warehouseId: mainWarehouse.id, code: 'FG-A01', name: '成品 A01', zone: '成品区' } });
  await prisma.stockLocation.upsert({ where: { warehouseId_code: { warehouseId: mainWarehouse.id, code: 'WIP-A01' } }, update: {}, create: { warehouseId: mainWarehouse.id, code: 'WIP-A01', name: '在制品 A01', zone: '生产周转区' } });
  const initialStocks = [
    { transactionNo: 'IT-DEMO-RAW-001', location: rawLocation, product: materialProduct, skuId: null, quantity: 1, unit: 'm³', type: 'PURCHASE_RECEIPT' as const, note: '演示采购已到货库存' },
    { transactionNo: 'IT-DEMO-FG-001', location: finishedLocation, product: demoProduct, skuId: demoSku.id, quantity: 6, unit: '件', type: 'ADJUSTMENT_IN' as const, note: '演示成品期初库存' },
  ];
  for (const stock of initialStocks) {
    const stockKey = `${stock.product.id}:${stock.skuId ?? '-'}`;
    await prisma.inventoryBalance.upsert({
      where: { locationId_stockKey: { locationId: stock.location.id, stockKey } },
      update: {},
      create: { organizationId: organization.id, warehouseId: mainWarehouse.id, locationId: stock.location.id, productId: stock.product.id, skuId: stock.skuId, stockKey, quantity: stock.quantity, unit: stock.unit },
    });
    await prisma.inventoryTransaction.upsert({
      where: { organizationId_transactionNo: { organizationId: organization.id, transactionNo: stock.transactionNo } }, update: {},
      create: { organizationId: organization.id, transactionNo: stock.transactionNo, type: stock.type, warehouseId: mainWarehouse.id, locationId: stock.location.id, productId: stock.product.id, skuId: stock.skuId, quantity: stock.quantity, beforeQuantity: 0, afterQuantity: stock.quantity, unit: stock.unit, referenceType: 'OPENING_BALANCE', note: stock.note, operatorId: admin.id },
    });
  }

  const demoReceivable = await prisma.accountReceivable.upsert({
    where: { salesOrderId: demoOrder.id }, update: {},
    create: { organizationId: organization.id, receivableNo: 'AR-DEMO-001', salesOrderId: demoOrder.id, customerId: demoCustomer.id, status: 'PARTIALLY_PAID', totalAmount: demoOrder.totalAmount, paidAmount: demoOrder.paidAmount, dueDate: new Date(Date.now() + 30 * 86400000), notes: '演示订单应收账款', createdById: admin.id },
  });
  await prisma.customerReceipt.upsert({
    where: { organizationId_receiptNo: { organizationId: organization.id, receiptNo: 'RC-DEMO-001' } }, update: {},
    create: { organizationId: organization.id, receiptNo: 'RC-DEMO-001', receivableId: demoReceivable.id, amount: 8000, method: 'BANK_TRANSFER', transactionRef: 'DEMO-DEPOSIT-001', note: '演示合同定金', collectedById: financeUser.id },
  });
  const demoPayable = await prisma.accountPayable.upsert({
    where: { purchaseOrderId: demoPurchase.id }, update: {},
    create: { organizationId: organization.id, payableNo: 'AP-DEMO-001', purchaseOrderId: demoPurchase.id, supplierId: demoSupplier.id, status: 'PARTIALLY_PAID', totalAmount: demoPurchase.totalAmount, paidAmount: 10000, dueDate: new Date(Date.now() + 30 * 86400000), notes: '演示采购应付账款', createdById: admin.id },
  });
  await prisma.supplierPayment.upsert({
    where: { organizationId_paymentNo: { organizationId: organization.id, paymentNo: 'PM-DEMO-001' } }, update: {},
    create: { organizationId: organization.id, paymentNo: 'PM-DEMO-001', payableId: demoPayable.id, amount: 10000, method: 'BANK_TRANSFER', transactionRef: 'DEMO-PURCHASE-001', note: '演示采购预付款', paidById: financeUser.id },
  });
  await prisma.expense.upsert({
    where: { organizationId_expenseNo: { organizationId: organization.id, expenseNo: 'EX-DEMO-001' } }, update: {},
    create: { organizationId: organization.id, expenseNo: 'EX-DEMO-001', category: '厂房费用', description: '九月生产车间电费', amount: 2600, taxAmount: 156, status: 'APPROVED', occurredAt: new Date(), dueDate: new Date(Date.now() + 7 * 86400000), applicantId: admin.id, approvedById: financeUser.id, approvedAt: new Date(), notes: '演示待支付费用' },
  });
  await prisma.payrollRecord.upsert({
    where: { organizationId_employeeId_period: { organizationId: organization.id, employeeId: workerUser.id, period: '2026-09' } }, update: {},
    create: { organizationId: organization.id, payrollNo: 'PY-DEMO-001', employeeId: workerUser.id, period: '2026-09', baseAmount: 8000, bonusAmount: 800, deductionAmount: 300, netAmount: 8500, status: 'CONFIRMED', notes: '演示九月工资单', createdById: financeUser.id },
  });

  console.log(isLocalDatabase ? 'Seed complete. Local demo login: admin / Admin123!' : 'Production seed complete. Demo accounts are disabled.');
}

main().finally(() => prisma.$disconnect());
