import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IntegrationChannelType, Prisma } from '@ffai/database';
import { compare, hash } from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiClientDto, CreateWebhookDto, EnqueueEventDto, IntegrationListQueryDto, ToggleDto, UpdateChannelDto } from './dto/integrations.dto';

const supportedScopes = ['catalog.read', 'order.status.read', 'events.write'];

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  channels(user: AuthUser) { return this.prisma.integrationChannel.findMany({ where: { organizationId: user.organizationId }, include: { _count: { select: { apiClients: true, subscriptions: true } } }, orderBy: { type: 'asc' } }); }

  async updateChannel(user: AuthUser, typeValue: string, input: UpdateChannelDto) {
    if (!Object.values(IntegrationChannelType).includes(typeValue as IntegrationChannelType)) throw new BadRequestException('不支持的集成渠道');
    return this.prisma.integrationChannel.upsert({ where: { organizationId_type: { organizationId: user.organizationId, type: typeValue as IntegrationChannelType } }, update: { name: input.name, status: input.status, config: input.config as Prisma.InputJsonValue | undefined, lastError: input.status === 'ACTIVE' ? null : undefined }, create: { organizationId: user.organizationId, type: typeValue as IntegrationChannelType, name: input.name, status: input.status, config: input.config as Prisma.InputJsonValue | undefined, createdById: user.sub } });
  }

  clients(user: AuthUser) { return this.prisma.apiClient.findMany({ where: { organizationId: user.organizationId }, select: { id: true, name: true, clientKey: true, scopes: true, active: true, lastUsedAt: true, createdAt: true, channel: { select: { id: true, type: true, name: true } } }, orderBy: { createdAt: 'desc' } }); }

  async createClient(user: AuthUser, input: CreateApiClientDto) {
    const invalid = input.scopes.filter((scope) => !supportedScopes.includes(scope)); if (invalid.length) throw new BadRequestException(`不支持的 API Scope: ${invalid.join(', ')}`);
    if (input.channelId) await this.assertChannel(user.organizationId, input.channelId);
    const clientKey = `ffai_${randomBytes(12).toString('hex')}`; const clientSecret = randomBytes(32).toString('base64url');
    const result = await this.prisma.apiClient.create({ data: { organizationId: user.organizationId, channelId: input.channelId, name: input.name, clientKey, secretHash: await hash(clientSecret, 12), scopes: [...new Set(input.scopes)], createdById: user.sub }, select: { id: true, name: true, clientKey: true, scopes: true, active: true, createdAt: true } });
    return { ...result, clientSecret, warning: '客户端密钥仅显示一次，请立即保存到安全的密钥管理服务。' };
  }

  async toggleClient(user: AuthUser, id: string, input: ToggleDto) { const current = await this.prisma.apiClient.findFirst({ where: { id, organizationId: user.organizationId } }); if (!current) throw new NotFoundException('API 客户端不存在'); return this.prisma.apiClient.update({ where: { id }, data: { active: input.active }, select: { id: true, name: true, clientKey: true, scopes: true, active: true } }); }

  webhooks(user: AuthUser) { return this.prisma.webhookSubscription.findMany({ where: { organizationId: user.organizationId }, select: { id: true, name: true, url: true, eventTypes: true, active: true, createdAt: true, channel: { select: { id: true, type: true, name: true } }, _count: { select: { deliveries: true } } }, orderBy: { createdAt: 'desc' } }); }

  async createWebhook(user: AuthUser, input: CreateWebhookDto) {
    this.assertWebhookUrl(input.url); if (!input.eventTypes.length) throw new BadRequestException('至少订阅一个事件类型'); if (input.channelId) await this.assertChannel(user.organizationId, input.channelId);
    const signingSecret = randomBytes(32).toString('base64url');
    const result = await this.prisma.webhookSubscription.create({ data: { organizationId: user.organizationId, channelId: input.channelId, name: input.name, url: input.url, eventTypes: [...new Set(input.eventTypes)], signingSecretEncrypted: this.encrypt(signingSecret), createdById: user.sub }, select: { id: true, name: true, url: true, eventTypes: true, active: true, createdAt: true } });
    return { ...result, signingSecret, warning: '签名密钥仅显示一次；接收端应校验 x-ffai-signature 与时间戳。' };
  }

  async toggleWebhook(user: AuthUser, id: string, input: ToggleDto) { const current = await this.prisma.webhookSubscription.findFirst({ where: { id, organizationId: user.organizationId } }); if (!current) throw new NotFoundException('Webhook 订阅不存在'); return this.prisma.webhookSubscription.update({ where: { id }, data: { active: input.active }, select: { id: true, name: true, url: true, eventTypes: true, active: true } }); }

  async enqueue(user: AuthUser, input: EnqueueEventDto) {
    return this.enqueueFor(user.organizationId, user.sub, input);
  }

  async outbox(user: AuthUser, query: IntegrationListQueryDto) {
    const where = { organizationId: user.organizationId }; const [items, total] = await this.prisma.$transaction([
      this.prisma.webhookOutbox.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { deliveries: { select: { id: true, status: true, attempts: true, nextAttemptAt: true, deliveredAt: true, responseStatus: true, lastError: true, subscription: { select: { name: true, url: true } } } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.webhookOutbox.count({ where }),
    ]); return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async dispatch(user: AuthUser) {
    const due = await this.prisma.webhookDelivery.findMany({ where: { outbox: { organizationId: user.organizationId }, status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: new Date() }, subscription: { active: true } }, include: { outbox: true, subscription: true }, orderBy: { nextAttemptAt: 'asc' }, take: 20 });
    let delivered = 0, failed = 0;
    for (const item of due) {
      await this.prisma.webhookDelivery.update({ where: { id: item.id }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
      const body = JSON.stringify({ id: item.outbox.eventId, type: item.outbox.eventType, createdAt: item.outbox.createdAt, data: item.outbox.payload }); const timestamp = Math.floor(Date.now() / 1000).toString(); const signature = createHmac('sha256', this.decrypt(item.subscription.signingSecretEncrypted)).update(`${timestamp}.${body}`).digest('hex');
      try {
        this.assertDispatchHost(item.subscription.url);
        const response = await fetch(item.subscription.url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'FFAI-Webhook/1.0', 'x-ffai-event-id': item.outbox.eventId, 'x-ffai-timestamp': timestamp, 'x-ffai-signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await this.prisma.webhookDelivery.update({ where: { id: item.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), responseStatus: response.status, lastError: null } }); delivered++;
      } catch (error) {
        const attempts = item.attempts + 1; await this.prisma.webhookDelivery.update({ where: { id: item.id }, data: { status: attempts >= 5 ? 'DEAD' : 'FAILED', responseStatus: null, lastError: (error instanceof Error ? error.message : '投递失败').slice(0, 500), nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 30) * 1000) } }); failed++;
      }
    }
    return { processed: due.length, delivered, failed };
  }

  async publicCatalog(request: Request) {
    const client = await this.authenticate(request, 'catalog.read');
    const items = await this.prisma.product.findMany({ where: { organizationId: client.organizationId, status: 'ACTIVE', publicVisible: true, deletedAt: null }, select: { productNo: true, name: true, shortName: true, brand: true, collection: true, materialNameCn: true, color: true, lengthMm: true, widthMm: true, heightMm: true, unit: true, retailPrice: true, currency: true, description: true, tags: true, category: { select: { code: true, name: true } }, skus: { where: { active: true }, select: { skuCode: true, name: true, attributes: true, retailPrice: true } } }, orderBy: { productNo: 'asc' } });
    return { items, total: items.length };
  }

  async publicOrder(request: Request, orderNo: string) {
    const client = await this.authenticate(request, 'order.status.read');
    const order = await this.prisma.salesOrder.findFirst({ where: { organizationId: client.organizationId, orderNo }, select: { orderNo: true, title: true, status: true, paymentStatus: true, totalAmount: true, paidAmount: true, expectedDeliveryAt: true, items: { select: { lineNo: true, description: true, specification: true, quantity: true, fulfilledQuantity: true, unit: true } }, shipments: { select: { shipmentNo: true, status: true, carrier: true, trackingNo: true, scheduledAt: true, dispatchedAt: true, deliveredAt: true } }, installations: { select: { installationNo: true, status: true, scheduledStartAt: true, actualStartAt: true, actualEndAt: true } } } });
    if (!order) throw new NotFoundException('订单不存在'); return order;
  }

  async publicEnqueue(request: Request, input: EnqueueEventDto) { const client = await this.authenticate(request, 'events.write'); return this.enqueueFor(client.organizationId, client.createdById, input); }

  private async authenticate(request: Request, scope: string) { const key = request.header('x-api-key'); const secret = request.header('x-api-secret'); if (!key || !secret) throw new UnauthorizedException('缺少 API 客户端凭据'); const client = await this.prisma.apiClient.findUnique({ where: { clientKey: key } }); if (!client || !client.active || !(await compare(secret, client.secretHash))) throw new UnauthorizedException('API 客户端凭据无效'); if (!client.scopes.includes(scope)) throw new ForbiddenException(`API 客户端缺少 ${scope} 权限`); await this.prisma.apiClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } }); return client; }
  private async enqueueFor(organizationId: string, createdById: string, input: EnqueueEventDto) { const subscriptions = await this.prisma.webhookSubscription.findMany({ where: { organizationId, active: true, eventTypes: { has: input.eventType } }, select: { id: true } }); return this.prisma.webhookOutbox.create({ data: { organizationId, eventId: randomUUID(), eventType: input.eventType, aggregateType: input.aggregateType, aggregateId: input.aggregateId, payload: input.payload as Prisma.InputJsonValue, createdById, deliveries: { create: subscriptions.map((item) => ({ subscriptionId: item.id })) } }, include: { deliveries: true } }); }
  private async assertChannel(organizationId: string, channelId: string) { const channel = await this.prisma.integrationChannel.findFirst({ where: { id: channelId, organizationId } }); if (!channel) throw new BadRequestException('集成渠道不存在'); }
  private assertWebhookUrl(value: string) { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) throw new BadRequestException('Webhook 仅支持 HTTP(S)'); if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new BadRequestException('生产环境 Webhook 必须使用 HTTPS'); }
  private assertDispatchHost(value: string) { const url = new URL(value); const allowed = (process.env.INTEGRATION_WEBHOOK_ALLOWED_HOSTS ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean); if (process.env.NODE_ENV === 'production' && (!allowed.length || !allowed.includes(url.hostname.toLowerCase()))) throw new Error('Webhook 主机不在生产允许列表'); }
  private encryptionKey() { const source = process.env.INTEGRATION_ENCRYPTION_KEY ?? process.env.JWT_ACCESS_SECRET ?? 'ffai-dev-only-integration-key'; return createHash('sha256').update(source).digest(); }
  private encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`; }
  private decrypt(value: string) { const [iv, tag, encrypted] = value.split('.'); const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'); }
}
