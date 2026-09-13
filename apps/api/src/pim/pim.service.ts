import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { IntegrationChannelType, Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { AddProductAssetDto, ApplyProductTemplateDto, CreateProductCategoryDto, CreateProductDto, CreateProductSkuDto, ProductListQueryDto, QueueProductSyncDto, UpdateProductDto } from './dto/pim.dto';
import { FieldPermissionService } from '../common/field-permission.service';

@Injectable()
export class PimService {
  constructor(private readonly prisma: PrismaService, private readonly fields: FieldPermissionService) {}

  async categories(user: AuthUser) {
    return this.prisma.productCategory.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async createCategory(user: AuthUser, input: CreateProductCategoryDto) {
    if (input.parentId) await this.assertCategory(user, input.parentId);
    return this.prisma.productCategory.create({ data: { ...input, organizationId: user.organizationId } });
  }

  templates(user: AuthUser) {
    return this.prisma.productTemplate.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: [{ categoryName: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, version: true, categoryCode: true, categoryName: true, productType: true, summary: true, defaults: true, skuBlueprints: true, channelMappings: true, assetChecklist: true, _count: { select: { products: true } } },
    });
  }

  async applyTemplate(user: AuthUser, code: string, input: ApplyProductTemplateDto) {
    await this.assertCostWrite(user, input.factoryPrice);
    const template = await this.prisma.productTemplate.findFirst({ where: { organizationId: user.organizationId, code, active: true } });
    if (!template) throw new NotFoundException('商品模板不存在或已停用');
    const defaults = this.asRecord(template.defaults);
    const blueprints = Array.isArray(template.skuBlueprints) ? template.skuBlueprints.map((item) => this.asRecord(item)) : [];
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.upsert({
        where: { organizationId_code: { organizationId: user.organizationId, code: template.categoryCode } },
        update: { name: template.categoryName, active: true },
        create: { organizationId: user.organizationId, code: template.categoryCode, name: template.categoryName, description: `由商品模板 ${template.code} 自动建立` },
      });
      const productNo = await this.nextNumber(tx, user.organizationId, 'PRODUCT');
      const factoryPrice = input.factoryPrice === undefined ? null : new Prisma.Decimal(input.factoryPrice);
      const priceMultiplier = new Prisma.Decimal(input.priceMultiplier ?? Number(defaults.priceMultiplier ?? 1.5));
      const product = await tx.product.create({ data: {
        organizationId: user.organizationId, sourceTemplateId: template.id, productNo, categoryId: category.id, type: template.productType,
        status: 'DRAFT', name: input.name.trim(), shortName: input.shortName?.trim() || null,
        brand: input.brand?.trim() || this.text(defaults.brand), collection: input.collection?.trim() || this.text(defaults.collection),
        materialNameCn: input.materialNameCn?.trim() || this.text(defaults.materialNameCn), materialNameEn: input.materialNameEn?.trim() || this.text(defaults.materialNameEn),
        color: input.color?.trim() || this.text(defaults.color), lengthMm: input.lengthMm ?? this.integer(defaults.lengthMm), widthMm: input.widthMm ?? this.integer(defaults.widthMm), heightMm: input.heightMm ?? this.integer(defaults.heightMm),
        unit: this.text(defaults.unit) ?? '件', factoryPrice, priceMultiplier, retailPrice: factoryPrice ? factoryPrice.mul(priceMultiplier) : null,
        description: this.text(defaults.description), tags: this.textArray(defaults.tags), publicVisible: false, createdById: user.sub, updatedById: user.sub,
      } });
      for (const [index, blueprint] of blueprints.entries()) {
        const suffix = this.text(blueprint.suffix) ?? String(index + 1).padStart(2, '0');
        await tx.productSku.create({ data: {
          productId: product.id, skuCode: `${productNo}-${suffix}`, name: `${input.name.trim()} · ${this.text(blueprint.name) ?? suffix}`,
          attributes: this.asRecord(blueprint.attributes) as Prisma.InputJsonValue, lengthMm: this.integer(blueprint.lengthMm) ?? product.lengthMm,
          widthMm: this.integer(blueprint.widthMm) ?? product.widthMm, heightMm: this.integer(blueprint.heightMm) ?? product.heightMm,
          factoryPrice, retailPrice: factoryPrice ? factoryPrice.mul(priceMultiplier) : null, isDefault: index === 0,
        } });
      }
      return tx.product.findUniqueOrThrow({ where: { id: product.id }, include: { category: true, sourceTemplate: { select: { code: true, name: true, version: true, assetChecklist: true } }, skus: { orderBy: { createdAt: 'asc' } } } });
    });
  }

  async list(user: AuthUser, query: ProductListQueryDto) {
    const where: Prisma.ProductWhereInput = {
      organizationId: user.organizationId, deletedAt: null,
      ...(query.status ? { status: query.status } : {}), ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.keyword ? { OR: [
        { productNo: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } },
        { shortName: { contains: query.keyword, mode: 'insensitive' } }, { materialNameCn: { contains: query.keyword, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total, groups] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { updatedAt: 'desc' }, include: {
        category: { select: { id: true, code: true, name: true } }, _count: { select: { skus: true, assets: true } },
      } }), this.prisma.product.count({ where }),
      this.prisma.product.groupBy({ by: ['status'], where: { organizationId: user.organizationId, deletedAt: null }, _count: true, orderBy: { status: 'asc' } }),
    ]);
    return { items: await Promise.all(items.map((item) => this.redactCost(user, item))), total, page: query.page, pageSize: query.pageSize, summary: Object.fromEntries(groups.map((group) => [group.status, group._count])) };
  }

  async detail(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null }, include: {
      category: true, skus: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
      sourceTemplate: { select: { code: true, name: true, version: true, assetChecklist: true } },
      channelListings: { select: { id: true, status: true, externalProductId: true, requestedAt: true, lastSyncedAt: true, lastError: true, channel: { select: { type: true, name: true } } } },
      assets: { orderBy: [{ type: 'asc' }, { sort: 'asc' }], include: { attachment: { select: { id: true, originalName: true, contentType: true, size: true, status: true } } } },
      createdBy: { select: { id: true, displayName: true } }, updatedBy: { select: { id: true, displayName: true } },
    } });
    if (!product) throw new NotFoundException('产品不存在');
    return this.redactCost(user, product);
  }

  async create(user: AuthUser, input: CreateProductDto) {
    await this.assertCostWrite(user, input.factoryPrice);
    this.assertPublish(user, input.status, input.publicVisible);
    if (input.categoryId) await this.assertCategory(user, input.categoryId);
    return this.prisma.$transaction(async (tx) => {
      const productNo = input.productNo?.trim() || await this.nextNumber(tx, user.organizationId, 'PRODUCT');
      const { factoryPrice, priceMultiplier = 1.5, ...data } = input;
      const retailPrice = factoryPrice === undefined ? undefined : new Prisma.Decimal(factoryPrice).mul(priceMultiplier);
      return tx.product.create({ data: {
        ...data, productNo, factoryPrice, priceMultiplier, retailPrice, organizationId: user.organizationId,
        createdById: user.sub, updatedById: user.sub,
      } });
    });
  }

  async update(user: AuthUser, id: string, input: UpdateProductDto) {
    const existing = await this.rawProduct(user, id);
    await this.assertCostWrite(user, input.factoryPrice);
    this.assertPublish(user, input.status, input.publicVisible);
    if (input.categoryId) await this.assertCategory(user, input.categoryId);
    const { factoryPrice, priceMultiplier, productNo, ...data } = input;
    const nextFactoryPrice = factoryPrice === undefined ? existing.factoryPrice : new Prisma.Decimal(factoryPrice);
    const nextMultiplier = priceMultiplier === undefined ? existing.priceMultiplier : new Prisma.Decimal(priceMultiplier);
    const retailPrice = nextFactoryPrice ? nextFactoryPrice.mul(nextMultiplier) : null;
    return this.prisma.product.update({ where: { id }, data: {
      ...data, ...(productNo ? { productNo: productNo.trim() } : {}),
      ...(factoryPrice !== undefined ? { factoryPrice } : {}), ...(priceMultiplier !== undefined ? { priceMultiplier } : {}),
      ...(factoryPrice !== undefined || priceMultiplier !== undefined ? { retailPrice } : {}), updatedById: user.sub,
    } });
  }

  async addSku(user: AuthUser, productId: string, input: CreateProductSkuDto) {
    const product = await this.rawProduct(user, productId);
    await this.assertCostWrite(user, input.factoryPrice);
    const factoryPrice = input.factoryPrice === undefined ? product.factoryPrice : new Prisma.Decimal(input.factoryPrice);
    const retailPrice = factoryPrice ? factoryPrice.mul(product.priceMultiplier) : null;
    const { factoryPrice: _cost, attributes, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.productSku.updateMany({ where: { productId }, data: { isDefault: false } });
      return tx.productSku.create({ data: { ...data, ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}), productId, factoryPrice, retailPrice } });
    });
  }

  async addAsset(user: AuthUser, productId: string, input: AddProductAssetDto) {
    await this.rawProduct(user, productId);
    const attachment = await this.prisma.attachment.findFirst({ where: { id: input.attachmentId, organizationId: user.organizationId, status: { not: 'DELETED' } } });
    if (!attachment) throw new BadRequestException('附件不存在或不可用');
    return this.prisma.productAsset.upsert({
      where: { productId_attachmentId_type: { productId, attachmentId: input.attachmentId, type: input.type } },
      update: input, create: { ...input, productId },
    });
  }

  async channelSync(user: AuthUser, id: string) {
    const product = await this.productForChannel(user, id);
    const channels = await this.prisma.integrationChannel.findMany({
      where: { organizationId: user.organizationId, type: { in: [IntegrationChannelType.TAOBAO, IntegrationChannelType.WECHAT_MINI_PROGRAM] } },
      include: { productListings: { where: { productId: id }, select: { id: true, status: true, externalProductId: true, requestedAt: true, lastSyncedAt: true, lastError: true, payloadChecksum: true } }, _count: { select: { subscriptions: { where: { active: true, eventTypes: { has: 'catalog.product.sync.requested' } } } } } },
      orderBy: { type: 'asc' },
    });
    return { productId: product.id, productNo: product.productNo, channels: channels.map((channel) => {
      const preview = this.buildChannelPreview(product, channel.type);
      return { id: channel.id, type: channel.type, name: channel.name, status: channel.status, configured: this.channelConfigured(channel.config) && channel._count.subscriptions > 0, blockers: preview.blockers, warnings: preview.warnings, payload: preview.payload, listing: channel.productListings[0] ?? null };
    }) };
  }

  async queueChannelSync(user: AuthUser, id: string, input: QueueProductSyncDto) {
    const requestedTypes = [...new Set(input.channels)].filter((type) => type === IntegrationChannelType.TAOBAO || type === IntegrationChannelType.WECHAT_MINI_PROGRAM);
    if (!requestedTypes.length) throw new BadRequestException('仅支持淘宝和微信小程序商品同步');
    const product = await this.productForChannel(user, id);
    const channels = await this.prisma.integrationChannel.findMany({ where: { organizationId: user.organizationId, type: { in: requestedTypes } } });
    const results: Array<Record<string, unknown>> = [];
    for (const type of requestedTypes) {
      const channel = channels.find((item) => item.type === type);
      if (!channel) { results.push({ type, status: 'BLOCKED', blockers: ['渠道尚未建立'] }); continue; }
      const preview = this.buildChannelPreview(product, type);
      const blockers = [...preview.blockers];
      if (channel.status !== 'ACTIVE') blockers.push('渠道未启用');
      if (!this.channelConfigured(channel.config)) blockers.push('渠道尚未配置适配器地址和凭据引用');
      const deliveryTargetCount = await this.prisma.webhookSubscription.count({ where: { organizationId: user.organizationId, channelId: channel.id, active: true, eventTypes: { has: 'catalog.product.sync.requested' } } });
      if (!deliveryTargetCount) blockers.push('渠道尚未创建有效的商品同步适配器订阅');
      if (input.dryRun) { results.push({ type, status: blockers.length ? 'BLOCKED' : 'READY', blockers, warnings: preview.warnings, payload: preview.payload }); continue; }
      const checksum = createHash('sha256').update(JSON.stringify(preview.payload)).digest('hex');
      if (blockers.length) {
        const listing = await this.prisma.productChannelListing.upsert({
          where: { productId_channelId: { productId: id, channelId: channel.id } },
          update: { status: 'BLOCKED', payload: preview.payload as Prisma.InputJsonValue, payloadChecksum: checksum, requestedById: user.sub, requestedAt: new Date(), lastError: blockers.join('；') },
          create: { organizationId: user.organizationId, productId: id, channelId: channel.id, status: 'BLOCKED', payload: preview.payload as Prisma.InputJsonValue, payloadChecksum: checksum, requestedById: user.sub, requestedAt: new Date(), lastError: blockers.join('；') },
        });
        results.push({ type, status: listing.status, blockers, listingId: listing.id }); continue;
      }
      const queued = await this.prisma.$transaction(async (tx) => {
        const listing = await tx.productChannelListing.upsert({
          where: { productId_channelId: { productId: id, channelId: channel.id } },
          update: { status: 'QUEUED', payload: preview.payload as Prisma.InputJsonValue, payloadChecksum: checksum, requestedById: user.sub, requestedAt: new Date(), lastError: null },
          create: { organizationId: user.organizationId, productId: id, channelId: channel.id, status: 'QUEUED', payload: preview.payload as Prisma.InputJsonValue, payloadChecksum: checksum, requestedById: user.sub, requestedAt: new Date() },
        });
        const subscriptions = await tx.webhookSubscription.findMany({ where: { organizationId: user.organizationId, channelId: channel.id, active: true, eventTypes: { has: 'catalog.product.sync.requested' } }, select: { id: true } });
        const event = await tx.webhookOutbox.create({ data: {
          organizationId: user.organizationId, eventId: randomUUID(), eventType: 'catalog.product.sync.requested', aggregateType: 'PRODUCT_CHANNEL_LISTING', aggregateId: listing.id,
          payload: { channel: type, listingId: listing.id, productId: id, productNo: product.productNo, checksum, data: preview.payload } as Prisma.InputJsonValue,
          createdById: user.sub, deliveries: { create: subscriptions.map((item) => ({ subscriptionId: item.id })) },
        } });
        return { listing, event, deliveryCount: subscriptions.length };
      });
      results.push({ type, status: queued.listing.status, listingId: queued.listing.id, eventId: queued.event.eventId, deliveryCount: queued.deliveryCount, warnings: queued.deliveryCount ? preview.warnings : [...preview.warnings, '已进入出站箱，但尚无对应渠道订阅端点'] });
    }
    return { productId: id, dryRun: input.dryRun ?? false, results };
  }

  private async productForChannel(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null }, include: {
      category: { select: { code: true, name: true } }, sourceTemplate: { select: { code: true, name: true, version: true, channelMappings: true } },
      skus: { where: { active: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
      assets: { where: { approved: true }, orderBy: [{ type: 'asc' }, { sort: 'asc' }], include: { attachment: { select: { storageKey: true, originalName: true, contentType: true, status: true } } } },
    } });
    if (!product) throw new NotFoundException('产品不存在');
    return product;
  }

  private buildChannelPreview(product: Awaited<ReturnType<PimService['productForChannel']>>, type: IntegrationChannelType) {
    const blockers: string[] = [], warnings: string[] = [];
    if (product.status !== 'ACTIVE') blockers.push('产品必须处于已上架状态');
    if (!product.publicVisible) blockers.push('产品尚未允许外部渠道使用');
    if (!product.retailPrice || Number(product.retailPrice) <= 0) blockers.push('建议零售价未设置');
    if (!product.category) blockers.push('产品分类未设置');
    if (!product.skus.length) blockers.push('至少需要一个有效 SKU');
    const mainImage = product.assets.find((asset) => asset.type === 'MAIN_IMAGE' && asset.attachment.status === 'READY');
    if (!mainImage) blockers.push('缺少已审核且可用的白底主图');
    if (!product.lengthMm || !product.widthMm || !product.heightMm) warnings.push('产品主尺寸未完整，渠道将优先使用 SKU 尺寸');
    const publicSkus = product.skus.map((sku) => ({ skuCode: sku.skuCode, name: sku.name, attributes: sku.attributes, lengthMm: sku.lengthMm, widthMm: sku.widthMm, heightMm: sku.heightMm, retailPrice: Number(sku.retailPrice ?? product.retailPrice ?? 0) }));
    const images = product.assets.filter((asset) => asset.attachment.status === 'READY').map((asset) => ({ type: asset.type, title: asset.title, storageKey: asset.attachment.storageKey, fileName: asset.attachment.originalName }));
    const common = { productNo: product.productNo, name: product.name, shortName: product.shortName, brand: product.brand, collection: product.collection, category: product.category, material: { cn: product.materialNameCn, en: product.materialNameEn }, color: product.color, dimensionsMm: { length: product.lengthMm, width: product.widthMm, height: product.heightMm }, unit: product.unit, retailPrice: Number(product.retailPrice ?? 0), currency: product.currency, description: product.description, tags: product.tags, skus: publicSkus, images, sourceTemplate: product.sourceTemplate };
    const payload = type === IntegrationChannelType.TAOBAO ? { adapter: 'TAOBAO_ITEM_UPSERT_V1', item: { outerId: product.productNo, title: [product.brand, product.materialNameCn, product.name].filter(Boolean).join(' '), price: common.retailPrice.toFixed(2), description: product.description, categoryCode: product.category?.code, properties: { collection: product.collection, material: product.materialNameCn, color: product.color }, skus: publicSkus.map((sku) => ({ outerId: sku.skuCode, title: sku.name, price: sku.retailPrice.toFixed(2), properties: sku.attributes })), images } } : { adapter: 'WECHAT_MINI_PROGRAM_PRODUCT_UPSERT_V1', product: { outProductId: product.productNo, title: product.name, brand: product.brand, category: product.category, salePriceFen: Math.round(common.retailPrice * 100), description: product.description, attrs: { material: product.materialNameCn, color: product.color, dimensionsMm: common.dimensionsMm }, skus: publicSkus.map((sku) => ({ outSkuId: sku.skuCode, title: sku.name, salePriceFen: Math.round(sku.retailPrice * 100), attrs: sku.attributes })), images } };
    return { blockers, warnings, payload };
  }

  private channelConfigured(value: Prisma.JsonValue | null) {
    const config = this.asRecord(value);
    return typeof config.adapterUrl === 'string' && config.adapterUrl.length > 0 && typeof config.credentialRef === 'string' && config.credentialRef.length > 0;
  }

  private asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private text(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
  private integer(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
  private textArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }

  private async rawProduct(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!product) throw new NotFoundException('产品不存在');
    return product;
  }

  private async assertCategory(user: AuthUser, id: string) {
    const category = await this.prisma.productCategory.findFirst({ where: { id, organizationId: user.organizationId, active: true } });
    if (!category) throw new BadRequestException('产品分类不存在或已停用');
  }

  private async assertCostWrite(user: AuthUser, factoryPrice: number | undefined) {
    if (factoryPrice !== undefined && (!user.permissions.includes('pim.cost.read') || !(await this.fields.canWrite(user, 'pim.product', 'factoryPrice')))) throw new ForbiddenException('当前角色无权维护产品成本');
  }

  private assertPublish(user: AuthUser, status?: string, publicVisible?: boolean) {
    if ((status === 'ACTIVE' || publicVisible === true) && !user.permissions.includes('pim.product.publish')) throw new ForbiddenException('当前角色无权发布产品');
  }

  private async redactCost<T>(user: AuthUser, value: T): Promise<T> {
    if (user.permissions.includes('pim.cost.read') && await this.fields.canRead(user, 'pim.product', 'factoryPrice')) return value;
    const result = { ...(value as Record<string, unknown>) };
    delete result.factoryPrice;
    if (Array.isArray(result.skus)) result.skus = result.skus.map((sku) => { const clean = { ...(sku as Record<string, unknown>) }; delete clean.factoryPrice; return clean; });
    return result as T;
  }

  private async nextNumber(tx: Prisma.TransactionClient, organizationId: string, code: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`;
    const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId, code } } });
    if (!rule || !rule.active) throw new NotFoundException(`业务编号规则 ${code} 不存在`);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
    const next = rule.currentDate === date ? rule.currentValue + 1 : 1;
    await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: next } });
    return `${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength, '0')}`;
  }
}
