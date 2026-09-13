# 家具工厂 AI 系统 V1.0（FFAI）

FFAI 是家具工厂的一体化数字运营平台。当前已完成 Sprint 0 统一底座、十二大业务中心和多端集成底座（Sprint 1 至 Sprint 13），形成从获客、设计、交易、采购、生产、库存、财务到交付、售后、任务预警和智能决策的本地可运行闭环。

## 当前交付

- pnpm + Turborepo Monorepo
- Next.js 15 + TypeScript 管理后台基础框架
- NestJS 11 + TypeScript REST API（统一 `/api/v1`）
- PostgreSQL + Prisma 数据模型、17 个顺序迁移和幂等种子数据
- 一个 User 多角色、组织树、RBAC、Data Scope、Field Permission
- JWT 短期访问令牌 + HttpOnly 刷新令牌；刷新令牌仅保存 SHA-256 摘要并支持撤销
- 完整用户账号中心：新增/编辑用户、工号与联系方式、多角色与多组织归属、账号状态、管理员重置密码、本人修改密码
- 权限变更、停用、锁定、改密和重置密码会递增会话版本并撤销旧刷新令牌，已签发的访问令牌立即失效
- 完整角色访问策略编辑：功能权限、六级数据范围、自定义组织范围、字段读写权限和侧栏可视模块一次配置
- 权限菜单、业务编号、数据字典、附件元数据、审计日志
- Docker Compose 中的 PostgreSQL 17 与 Redis 7；S3 / Cloudflare R2 环境变量接口已预留
- 老板/管理员、销售、客服、内外部设计师、厂长、工人、质检、仓库、财务、采购、安装、经销商、客户共 15 个标准角色
- CRM 首个完整业务切片：客户、联系人、线索、跟进活动、销售漏斗和线索转客户
- CRM 行级数据范围已接入 RBAC；销售角色默认只访问本人负责的数据
- 项目设计中心首个完整业务切片：项目档案、空间、项目成员、设计版本与评审状态
- 项目成员与 RBAC Data Scope 联合控制：管理角色可看全公司，普通角色只看负责或参与的项目
- PIM 产品主数据、分类、SKU、数字素材关联、发布状态和成本字段权限；零售价默认按工厂价 × 1.5 计算
- PIM 成熟商品模板库：实木座椅、实木大板、餐桌、茶桌、实木床和柜体模板可一键生成草稿、SKU、素材清单及淘宝/小程序字段映射
- 报价明细从 PIM 自动带入完整产品名、材质和价格，支持规格、数量、单位、折扣、备注、整单优惠、税额重算、提交审批、客户接受、合同快照以及 Word/PNG 正式单据导出
- 生效合同原子化生成销售订单快照，支持交期、付款状态、订单明细和完整状态流转历史
- SCM 供应商档案、采购单、来源销售订单、采购计价审批、正式下单和分批收货闭环
- MES 生产订单、销售订单下达生产、标准工艺路线、工单分派、工人报工、工序逐级解锁和完工回写 OMS 闭环
- WMS 仓库库位、实时结存与不可跳号库存流水；支持采购/生产入库、调拨、出库、盘点调整和并发防超发
- 财务中心应收收款、应付付款、费用审批支付、月度工资与现金/经营贡献汇总；收款同步回写 OMS 付款状态
- 物流安装售后中心覆盖配送建单、备货、原子出库、执行人签收、现场安装和售后闭环；发车/完工自动推进 OMS 状态
- 任务预警中心支持跨部门待办、执行人数据隔离、截止提醒和状态机；异常扫描覆盖订单、采购、生产、财务、库存、履约与售后
- BI / AI 中心聚合全链经营指标、每日幂等快照和有证据的可解释洞察；洞察生成、查看与管理分别授权
- 多端集成中心预置官网、微信小程序、淘宝、企业微信、设计师中心和经销商中心；提供 Scope API 客户端、公开 REST、Webhook 签名、出站箱和重试状态
- 商品渠道同步按单品保存预检、阻断原因、载荷摘要和发布状态；渠道适配器通过凭据引用获取平台密钥，PIM 对外载荷不会包含工厂价

## 目录

```text
apps/
  api/                 NestJS API、认证、权限守卫和系统基础接口
  web/                 Next.js 登录页、工作台、系统管理框架
packages/
  database/            Prisma schema、迁移、种子数据和共享客户端
```

## 本地启动

要求：Node.js 22+、pnpm 11+，以及 PostgreSQL 17。Redis 是后续缓存/队列集成的预留服务，当前 API 启动不依赖它。

1. 创建环境变量：

   ```powershell
   Copy-Item .env.example .env
   ```

2. 启动基础服务。若本机安装了 Docker Desktop：

   ```powershell
   docker compose up -d postgres redis
   ```

   Docker 中的 PostgreSQL 映射到宿主机 `5433`，避免与本机可能已有的 PostgreSQL `5432` 冲突。也可使用原生 PostgreSQL，并创建名为 `ffai` 的数据库；连接信息与 `.env` 中的 `DATABASE_URL` 保持一致即可。

3. 安装、迁移并写入种子数据：

   ```powershell
   pnpm install
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

4. 启动 Web 与 API：

   ```powershell
   pnpm dev
   ```

5. 打开 `http://localhost:3000`。开发种子账号：

   - 企业代码：`FFAI_DEMO`
   - 用户名：`admin`
   - 密码：`Admin123!`

   限权验收账号：`sales01 / Sales123!`。该账号使用 `SELF` 数据范围，用于验证 CRM 数据隔离，以及只能访问本人负责或参与的项目。工人工作台账号：`worker01 / Worker123!`，默认只能查看分配给自己的生产工单并报工。仓管账号：`warehouse01 / Warehouse123!`，用于库存入库、调拨、出库与盘点验收。财务账号：`finance01 / Finance123!`，用于收付款、费用与工资核算验收。物流安装账号：`installer01 / Installer123!`，只能查看和处理分配给自己的配送、安装与售后任务。

首次部署必须更换种子密码与两项 JWT Secret。

## 验证

无需数据库即可执行静态验证：

```powershell
pnpm db:generate
pnpm typecheck
pnpm build
```

数据库启动且迁移/种子完成后，可执行真实链路验证：

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
$login = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/auth/login -ContentType application/json -Body '{"organizationCode":"FFAI_DEMO","username":"admin","password":"Admin123!"}' -SessionVariable session
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod http://localhost:4000/api/v1/me -Headers $headers
Invoke-RestMethod http://localhost:4000/api/v1/system/users -Headers $headers
Invoke-RestMethod http://localhost:4000/api/v1/projects -Headers $headers
```

## Cloudflare 部署

系统已经配置为名为 `ffai` 的 Cloudflare Worker：Next.js 管理后台由 Workers Static Assets 提供，`/api/*` 由同一个 Worker 转发到运行 NestJS 的 Cloudflare Container。前后端使用同一域名，线上前端固定请求 `/api/v1`，无需暴露跨域 API 地址。

先验证静态导出和 Cloudflare 配置：

```powershell
pnpm cf:build
pnpm cf:types
pnpm cf:dry-run
```

确认托管 PostgreSQL、完成迁移并设置 Cloudflare Secrets 后再发布：

```powershell
pnpm db:deploy
pnpm cf:deploy
```

Cloudflare 账号已固定为 `8389955@qq.com's Account`，避免误发到其他账号。生产数据库必须是启用 TLS 的公网托管 PostgreSQL；本机 Docker 中的 `localhost:5433` 只能用于开发，Cloudflare Container 无法把它当作生产数据库。`DATABASE_URL`、JWT Secret 和集成加密密钥必须使用 Cloudflare Worker Secrets 注入，不写入 `wrangler.jsonc` 或代码。Cloudflare Containers 需要 Workers Paid 套餐，启用前应确认账号计费状态。

## 权限模型

一次请求按以下顺序决策：

```text
User → 多角色合并 → Permission（功能）→ Data Scope（行级数据）→ Field Permission（字段）→ Audit Log
```

Data Scope 支持 `ALL`、`COMPANY`、`DEPARTMENT`、`DEPARTMENT_AND_CHILDREN`、`SELF` 和 `CUSTOM`。当前用户列表接口已经执行组织/本人范围过滤；后续每个业务中心必须通过同一策略层接入，禁止在页面端代替服务端权限控制。

字段权限模型以 `role + resource + field` 唯一，分别记录可读与可写。当前已接入用户敏感资料、PIM 工厂价和工资金额字段的服务端读取裁剪与写入校验；多角色按授权并集合并，老板角色保留最高权限。新增资源应继续通过统一 `FieldPermissionService` 接入，禁止只在页面隐藏字段。

## API 基础接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/v1/health` | API 与数据库健康检查 |
| POST | `/api/v1/auth/login` | 登录并签发访问/刷新令牌 |
| POST | `/api/v1/auth/refresh` | 用 HttpOnly Cookie 刷新访问令牌 |
| POST | `/api/v1/auth/logout` | 撤销当前刷新令牌 |
| GET | `/api/v1/me` | 当前用户、角色、组织与权限 |
| GET | `/api/v1/me/menus` | 多角色合并后的菜单 |
| PATCH | `/api/v1/me/profile` | 修改本人姓名、手机号和邮箱 |
| POST | `/api/v1/me/change-password` | 校验当前密码后改密并撤销全部旧会话 |
| GET/POST | `/api/v1/system/users` | 应用 Data Scope 的用户列表 / 新增统一账号 |
| GET/PATCH | `/api/v1/system/users/:id` | 用户资料、多角色与多组织详情 / 更新 |
| POST | `/api/v1/system/users/:id/reset-password` | 管理员重置临时密码并撤销旧会话 |
| GET | `/api/v1/system/access-options` | 角色、组织、权限、菜单和字段目录 |
| GET/POST | `/api/v1/system/roles` | 角色列表 / 新建自定义角色 |
| GET | `/api/v1/system/roles/:id` | 角色完整访问策略 |
| PATCH | `/api/v1/system/roles/:id/access` | 保存功能、数据、字段和可视模块权限 |
| GET | `/api/v1/system/org-units` | 组织树基础数据 |
| GET | `/api/v1/system/dictionaries` | 数据字典 |
| GET | `/api/v1/system/audit-logs` | 审计日志 |
| POST | `/api/v1/system/business-numbers/next` | PostgreSQL 事务锁保护的业务编号 |
| POST | `/api/v1/system/attachments` | 注册附件元数据和隔离存储键 |
| GET/POST | `/api/v1/crm/customers` | 客户列表与新增客户 |
| GET/PATCH | `/api/v1/crm/customers/:id` | 客户详情与编辑 |
| POST | `/api/v1/crm/customers/:id/contacts` | 新增客户联系人 |
| POST | `/api/v1/crm/customers/:id/activities` | 新增客户跟进 |
| GET/POST | `/api/v1/crm/leads` | 线索列表与新增线索 |
| GET/PATCH | `/api/v1/crm/leads/:id` | 线索详情与推进阶段 |
| POST | `/api/v1/crm/leads/:id/activities` | 新增线索跟进 |
| POST | `/api/v1/crm/leads/:id/convert` | 原子化线索转客户 |
| GET/POST | `/api/v1/projects` | 项目列表与新增项目 |
| GET/PATCH | `/api/v1/projects/:id` | 项目详情与编辑 |
| POST | `/api/v1/projects/:id/spaces` | 新增项目空间 |
| POST | `/api/v1/projects/:id/members` | 新增或更新项目成员 |
| POST | `/api/v1/projects/:id/design-versions` | 新建设计版本 |
| PATCH | `/api/v1/projects/:id/design-versions/:versionId` | 更新设计评审状态 |
| GET/POST | `/api/v1/pim/products` | 产品列表与新增产品 |
| GET/PATCH | `/api/v1/pim/products/:id` | 产品详情与编辑发布状态 |
| GET/POST | `/api/v1/pim/categories` | 产品分类列表与新增分类 |
| GET | `/api/v1/pim/product-templates` | 成熟家具商品模板库 |
| POST | `/api/v1/pim/product-templates/:code/apply` | 从模板生成产品草稿和 SKU |
| POST | `/api/v1/pim/products/:id/skus` | 新增产品规格 |
| POST | `/api/v1/pim/products/:id/assets` | 绑定产品数字素材 |
| GET/POST | `/api/v1/pim/products/:id/channel-sync` | 淘宝/小程序载荷预检与同步任务入队 |
| GET/POST | `/api/v1/commercial/quotations` | 报价列表与新建报价 |
| GET/PATCH | `/api/v1/commercial/quotations/:id` | 报价详情与草稿编辑 |
| POST | `/api/v1/commercial/quotations/:id/items` | 新增报价明细并重新计价 |
| PATCH/DELETE | `/api/v1/commercial/quotations/:id/items/:itemId` | 编辑或删除草稿报价明细 |
| GET | `/api/v1/commercial/quotations/:id/export?format=docx\|png` | 导出报价 Word 或图片 |
| POST | `/api/v1/commercial/quotations/:id/submit` | 提交报价审批 |
| POST | `/api/v1/commercial/quotations/:id/approve` | 审批报价 |
| POST | `/api/v1/commercial/quotations/:id/contract` | 从客户已接受报价生成合同 |
| GET | `/api/v1/commercial/contracts/:id/export?format=docx\|png` | 导出合同 Word 或图片 |
| POST | `/api/v1/commercial/contracts/:id/transition` | 合同待签、生效、完成状态流转 |
| GET | `/api/v1/oms/available-contracts` | 查询尚未生成订单的生效合同 |
| GET/POST | `/api/v1/oms/orders` | 订单列表与从合同生成订单 |
| GET | `/api/v1/oms/orders/:id` | 订单明细与状态历史 |
| POST | `/api/v1/oms/orders/:id/transition` | 按状态机推进订单 |
| GET/POST | `/api/v1/scm/suppliers` | 供应商列表与新增供应商 |
| GET/POST | `/api/v1/scm/purchase-orders` | 采购单列表与新增采购单 |
| GET | `/api/v1/scm/purchase-orders/:id` | 采购单和收货明细 |
| POST | `/api/v1/scm/purchase-orders/:id/items` | 新增采购明细并重新计价 |
| POST | `/api/v1/scm/purchase-orders/:id/submit` | 提交采购审批 |
| POST | `/api/v1/scm/purchase-orders/:id/approve` | 审批采购单 |
| POST | `/api/v1/scm/purchase-orders/:id/place` | 确认向供应商下单 |
| POST | `/api/v1/scm/purchase-orders/:id/items/:itemId/receive` | 旧收货入口（已禁用，返回 WMS 引导） |
| GET | `/api/v1/mes/available-orders` | 查询尚未下达生产的销售订单 |
| GET/POST | `/api/v1/mes/production-orders` | 生产订单列表与从销售订单下达生产 |
| GET | `/api/v1/mes/production-orders/:id` | 生产明细、工艺路线、工单和报工记录 |
| POST | `/api/v1/mes/production-orders/:id/release` | 下达生产并生成标准工艺路线 |
| PATCH | `/api/v1/mes/production-orders/:id/work-orders/:workOrderId` | 分派或调整工单 |
| POST | `/api/v1/mes/production-orders/:id/work-orders/:workOrderId/reports` | 工单开工、进度、异常和完工报工 |
| GET/POST | `/api/v1/wms/warehouses` | 仓库与库位主数据 |
| POST | `/api/v1/wms/warehouses/:id/locations` | 新增仓库库位 |
| GET | `/api/v1/wms/inventory` | 实时库存、预留量与可用量 |
| GET | `/api/v1/wms/transactions` | 库存收发存流水 |
| GET | `/api/v1/wms/receivable-purchase-items` | 查询待采购入库明细 |
| GET | `/api/v1/wms/receivable-production-items` | 查询待生产完工入库明细 |
| POST | `/api/v1/wms/receipts/purchase` | 采购分批入库并回写采购到货状态 |
| POST | `/api/v1/wms/receipts/production` | 生产完工分批入库 |
| POST | `/api/v1/wms/issues` | 库存出库并防止负库存 |
| POST | `/api/v1/wms/transfers` | 两库位间原子化调拨 |
| POST | `/api/v1/wms/adjustments` | 显式确认的盘点调整 |
| GET | `/api/v1/finance/dashboard` | 应收、应付、现金流与经营贡献汇总 |
| GET | `/api/v1/finance/receivables` | 按数据范围查询应收和收款记录 |
| POST | `/api/v1/finance/receivables/sync` | 从有效销售订单幂等同步应收单 |
| POST | `/api/v1/finance/receivables/:id/receipts` | 登记收款并回写订单付款状态 |
| GET | `/api/v1/finance/payables` | 按数据范围查询应付和付款记录 |
| POST | `/api/v1/finance/payables/sync` | 从有效采购订单幂等同步应付单 |
| POST | `/api/v1/finance/payables/:id/payments` | 登记供应商付款 |
| GET/POST | `/api/v1/finance/expenses` | 费用列表与费用申请 |
| POST | `/api/v1/finance/expenses/:id/submit` | 提交费用审批 |
| POST | `/api/v1/finance/expenses/:id/approve` | 审批费用 |
| POST | `/api/v1/finance/expenses/:id/pay` | 支付已审批费用 |
| GET/POST | `/api/v1/finance/payroll` | 月度工资列表与建单 |
| POST | `/api/v1/finance/payroll/:id/confirm` | 确认工资单 |
| POST | `/api/v1/finance/payroll/:id/pay` | 发放已确认工资 |
| GET/POST | `/api/v1/fulfillment/shipments` | 配送单列表与从待发货订单建单 |
| GET | `/api/v1/fulfillment/shipments/:id` | 配送明细、出库库位与安装关联 |
| POST | `/api/v1/fulfillment/shipments/:id/ready` | 标记配送单备货完成 |
| POST | `/api/v1/fulfillment/shipments/:id/dispatch` | 原子扣减库存、记录销售出库并推进订单发货 |
| POST | `/api/v1/fulfillment/shipments/:id/deliver` | 配送执行人登记签收凭证 |
| GET/POST | `/api/v1/fulfillment/installations` | 安装任务列表与从已签收配送单建单 |
| PATCH | `/api/v1/fulfillment/installations/:id/schedule` | 分派安装师傅与预约时间 |
| POST | `/api/v1/fulfillment/installations/:id/start` | 安装执行人开工 |
| POST | `/api/v1/fulfillment/installations/:id/complete` | 登记安装完工并推进订单已安装 |
| GET/POST | `/api/v1/fulfillment/after-sales` | 售后工单列表与建单 |
| PATCH | `/api/v1/fulfillment/after-sales/:id` | 按状态机分派、处理、解决或关闭售后 |
| POST | `/api/v1/fulfillment/after-sales/:id/comments` | 追加售后处理记录 |
| GET/POST | `/api/v1/tasks` | 按数据范围查询任务与创建任务 |
| PATCH | `/api/v1/tasks/:id` | 任务开始、完成、重开或取消状态流转 |
| GET | `/api/v1/tasks/dashboard` | 我的任务、超期、临期与活动预警汇总 |
| GET | `/api/v1/tasks/alerts/list` | 业务预警列表 |
| POST | `/api/v1/tasks/alerts/scan` | 幂等扫描全链业务异常并自动关闭已消失异常 |
| PATCH | `/api/v1/tasks/alerts/:id` | 确认、解决或忽略预警 |
| GET | `/api/v1/analytics/dashboard` | 实时跨中心经营指标 |
| GET | `/api/v1/analytics/trends` | 每日指标快照趋势 |
| POST | `/api/v1/analytics/snapshots` | 幂等保存今日经营快照 |
| GET | `/api/v1/analytics/insights` | 可解释智能洞察列表 |
| POST | `/api/v1/analytics/insights/generate` | 按当前证据重新生成经营洞察 |
| GET/PATCH | `/api/v1/integrations/channels` | 六类渠道配置与启停 |
| GET/POST | `/api/v1/integrations/clients` | API 客户端管理；Secret 仅创建时返回一次 |
| GET/POST | `/api/v1/integrations/webhooks` | Webhook 订阅管理；签名密钥加密存储 |
| POST | `/api/v1/integrations/events` | 写入 Webhook 事务出站箱 |
| GET | `/api/v1/integrations/outbox` | 查看每个端点的独立投递和重试状态 |
| POST | `/api/v1/integrations/dispatch` | 批量投递到生产主机允许列表 |
| GET | `/api/v1/integrations/open/catalog` | 外部渠道读取公开产品目录 |
| GET | `/api/v1/integrations/open/orders/:orderNo` | 外部渠道读取订单履约状态 |
| POST | `/api/v1/integrations/open/events` | 具有 `events.write` Scope 的渠道写入标准事件出站箱 |

## 多端 REST 与 Webhook

外部 REST 请求使用 `x-api-key` 与 `x-api-secret`，客户端 Scope 当前支持 `catalog.read`、`order.status.read` 和 `events.write`。Secret 只在创建时显示一次，数据库仅保存 bcrypt 摘要。

Webhook 请求包含 `x-ffai-event-id`、`x-ffai-timestamp` 和 `x-ffai-signature`。签名内容为 `HMAC-SHA256(signingSecret, timestamp + "." + rawBody)`；签名密钥通过 `INTEGRATION_ENCRYPTION_KEY` 进行 AES-256-GCM 加密。生产环境只允许 HTTPS，并要求目标主机存在于 `INTEGRATION_WEBHOOK_ALLOWED_HOSTS` 逗号分隔允许列表。

## Sprint 边界与后续接入

十二大中心均已具备可运行的首批业务闭环。官网、微信小程序、淘宝、企业微信、设计师中心与经销商中心已通过统一渠道、REST 凭据和 Webhook 出站箱预留接入点，不另建身份孤岛。各平台正式上线仍需分别提供平台 AppId、Secret、回调域名及平台审核资质，再在集成中心启用对应渠道。

数据库迁移按依赖顺序维护为 Sprint 0 至 Sprint 13 十四个版本，并持续通过空白数据库全量重建验证。项目、产品、报价、合同、销售订单、供应商、采购单、生产订单、工单、库存流水、财务凭证、配送、安装、售后和任务编号以及设计版本号均由 PostgreSQL 事务锁保护，避免并发重复。

当前交付目标为本机 V1.0 基线。正式生产化前仍需结合部署环境补齐：S3/R2 预签名上传与病毒扫描回调、Redis 分布式队列与限流、密码重置与 MFA、全资源 Field Permission 序列化拦截器、OpenAPI 文档、自动化集成测试、备份恢复演练和部署流水线。

## 安全约束

- 多租户查询必须携带 `organizationId`；禁止相信客户端传入的企业 ID。
- 所有写操作由 API 权限守卫判定，并自动写入审计日志。
- 附件对象键由服务端生成；业务记录只保存对象键，不暴露云存储凭证。
- 演示密码、开发数据库密码和示例 Secret 不可用于生产。
- API Client Secret 与 Webhook Signing Secret 仅在创建时显示一次；生产必须使用独立密钥管理服务。
- 生产 Webhook 目标必须配置主机允许列表，禁止向未审核地址投递。
- Prisma 迁移进入版本控制；禁止在生产直接使用 `prisma db push`。
