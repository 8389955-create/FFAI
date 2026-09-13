import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTransactionType, Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, CreateLocationDto, CreateWarehouseDto, ProductionReceiptDto, PurchaseReceiptDto, StockIssueDto, TransferStockDto, WmsListQueryDto } from './dto/wms.dto';

@Injectable()
export class WmsService {
  constructor(private readonly prisma: PrismaService) {}

  warehouses(user: AuthUser) {
    return this.prisma.warehouse.findMany({
      where: { organizationId: user.organizationId },
      include: { locations: { orderBy: { code: 'asc' } }, _count: { select: { balances: true } } },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
  }

  createWarehouse(user: AuthUser, input: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: { organizationId: user.organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), type: input.type, address: input.address, createdById: user.sub },
    });
  }

  async createLocation(user: AuthUser, warehouseId: string, input: CreateLocationDto) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId: user.organizationId } });
    if (!warehouse) throw new NotFoundException('仓库不存在');
    return this.prisma.stockLocation.create({ data: { warehouseId, code: input.code.trim().toUpperCase(), name: input.name.trim(), zone: input.zone } });
  }

  async inventory(user: AuthUser, query: WmsListQueryDto) {
    const skip = (query.page - 1) * query.pageSize;
    const where: Prisma.InventoryBalanceWhereInput = {
      organizationId: user.organizationId,
      warehouseId: query.warehouseId,
      locationId: query.locationId,
      productId: query.productId,
      ...(query.keyword ? { OR: [
        { product: { name: { contains: query.keyword, mode: 'insensitive' } } },
        { product: { productNo: { contains: query.keyword, mode: 'insensitive' } } },
        { sku: { skuCode: { contains: query.keyword, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryBalance.findMany({ where, skip, take: query.pageSize, include: { warehouse: true, location: true, product: { select: { id: true, productNo: true, name: true, type: true } }, sku: { select: { id: true, skuCode: true, name: true } } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.inventoryBalance.count({ where }),
    ]);
    return { items: items.map((item) => ({ ...item, availableQuantity: Number(item.quantity) - Number(item.reservedQuantity) })), total, page: query.page, pageSize: query.pageSize };
  }

  async transactions(user: AuthUser, query: WmsListQueryDto) {
    const skip = (query.page - 1) * query.pageSize;
    const where: Prisma.InventoryTransactionWhereInput = {
      organizationId: user.organizationId,
      warehouseId: query.warehouseId,
      locationId: query.locationId,
      productId: query.productId,
      type: query.type,
      ...(query.keyword ? { OR: [
        { transactionNo: { contains: query.keyword, mode: 'insensitive' } },
        { product: { name: { contains: query.keyword, mode: 'insensitive' } } },
        { referenceId: { contains: query.keyword, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.findMany({ where, skip, take: query.pageSize, include: { warehouse: true, location: true, product: { select: { productNo: true, name: true } }, sku: { select: { skuCode: true, name: true } }, operator: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async receivablePurchaseItems(user: AuthUser) {
    const items = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrder: { organizationId: user.organizationId, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } }, productId: { not: null } },
      include: { purchaseOrder: { select: { id: true, purchaseOrderNo: true, status: true, supplier: { select: { name: true } } } }, product: { select: { productNo: true, name: true } }, sku: { select: { skuCode: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return items.filter((item) => Number(item.receivedQuantity) < Number(item.quantity)).map((item) => ({ ...item, remainingQuantity: Number(item.quantity) - Number(item.receivedQuantity) }));
  }

  async receivableProductionItems(user: AuthUser) {
    const items = await this.prisma.productionOrderItem.findMany({
      where: { productionOrder: { organizationId: user.organizationId, status: 'COMPLETED' }, productId: { not: null } },
      include: { productionOrder: { select: { id: true, productionOrderNo: true } }, product: { select: { productNo: true, name: true } }, sku: { select: { skuCode: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!items.length) return [];
    const received = await this.prisma.inventoryTransaction.groupBy({
      by: ['referenceLineId'],
      where: { organizationId: user.organizationId, type: 'PRODUCTION_RECEIPT', referenceLineId: { in: items.map((item) => item.id) } },
      _sum: { quantity: true },
    });
    const sums = new Map(received.map((entry) => [entry.referenceLineId, Number(entry._sum.quantity ?? 0)]));
    return items.map((item) => ({ ...item, receivedQuantity: sums.get(item.id) ?? 0, remainingQuantity: Number(item.completedQuantity) - (sums.get(item.id) ?? 0) })).filter((item) => item.remainingQuantity > 0);
  }

  receivePurchase(user: AuthUser, input: PurchaseReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wms-purchase:${input.purchaseOrderItemId}`}))`;
      const item = await tx.purchaseOrderItem.findFirst({ where: { id: input.purchaseOrderItemId, purchaseOrder: { organizationId: user.organizationId } }, include: { purchaseOrder: true } });
      if (!item || !item.productId) throw new BadRequestException('采购明细不存在或未关联产品');
      if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(item.purchaseOrder.status)) throw new BadRequestException('采购单当前状态不能入库');
      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      if (input.quantity > remaining + 0.000001) throw new BadRequestException(`入库数量超过待收数量 ${remaining}`);
      const transaction = await this.mutateStock(tx, user, { locationId: input.locationId, productId: item.productId, skuId: item.skuId, quantity: input.quantity, unit: item.unit, type: 'PURCHASE_RECEIPT', referenceType: 'PURCHASE_ORDER', referenceId: item.purchaseOrder.purchaseOrderNo, referenceLineId: item.id, batchNo: input.batchNo, note: input.note });
      const updated = await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQuantity: { increment: input.quantity } } });
      const allItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: item.purchaseOrderId } });
      const complete = allItems.every((entry) => entry.id === updated.id ? Number(updated.receivedQuantity) >= Number(updated.quantity) : Number(entry.receivedQuantity) >= Number(entry.quantity));
      await tx.purchaseOrder.update({ where: { id: item.purchaseOrderId }, data: { status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED' } });
      return transaction;
    });
  }

  receiveProduction(user: AuthUser, input: ProductionReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wms-production:${input.productionOrderItemId}`}))`;
      const item = await tx.productionOrderItem.findFirst({ where: { id: input.productionOrderItemId, productionOrder: { organizationId: user.organizationId, status: 'COMPLETED' } }, include: { productionOrder: true } });
      if (!item || !item.productId) throw new BadRequestException('已完工生产明细不存在或未关联产品');
      const aggregate = await tx.inventoryTransaction.aggregate({ where: { organizationId: user.organizationId, type: 'PRODUCTION_RECEIPT', referenceLineId: item.id }, _sum: { quantity: true } });
      const remaining = Number(item.completedQuantity) - Number(aggregate._sum.quantity ?? 0);
      if (input.quantity > remaining + 0.000001) throw new BadRequestException(`入库数量超过待入库数量 ${remaining}`);
      return this.mutateStock(tx, user, { locationId: input.locationId, productId: item.productId, skuId: item.skuId, quantity: input.quantity, unit: item.unit, type: 'PRODUCTION_RECEIPT', referenceType: 'PRODUCTION_ORDER', referenceId: item.productionOrder.productionOrderNo, referenceLineId: item.id, batchNo: input.batchNo, note: input.note });
    });
  }

  issue(user: AuthUser, input: StockIssueDto) {
    return this.prisma.$transaction((tx) => this.mutateStock(tx, user, { ...input, quantity: -input.quantity, type: 'SALES_ISSUE' }));
  }

  transfer(user: AuthUser, input: TransferStockDto) {
    if (input.fromLocationId === input.toLocationId) throw new BadRequestException('调出与调入库位不能相同');
    return this.prisma.$transaction(async (tx) => {
      const transferRef = `TRANSFER-${Date.now()}`;
      const outbound = await this.mutateStock(tx, user, { locationId: input.fromLocationId, productId: input.productId, skuId: input.skuId, quantity: -input.quantity, unit: input.unit, type: 'TRANSFER_OUT', referenceType: 'TRANSFER', referenceId: transferRef, note: input.note });
      const inbound = await this.mutateStock(tx, user, { locationId: input.toLocationId, productId: input.productId, skuId: input.skuId, quantity: input.quantity, unit: input.unit, type: 'TRANSFER_IN', referenceType: 'TRANSFER', referenceId: transferRef, note: input.note });
      return { referenceId: transferRef, outbound, inbound };
    });
  }

  adjust(user: AuthUser, input: AdjustStockDto) {
    if (input.confirm !== true) throw new BadRequestException('库存调整必须显式确认');
    if (Math.abs(input.quantityChange) < 0.001) throw new BadRequestException('调整数量不能为零');
    return this.prisma.$transaction((tx) => this.mutateStock(tx, user, { locationId: input.locationId, productId: input.productId, skuId: input.skuId, quantity: input.quantityChange, unit: input.unit, type: input.quantityChange > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', referenceType: 'STOCK_ADJUSTMENT', note: input.reason }));
  }

  private async mutateStock(tx: Prisma.TransactionClient, user: AuthUser, input: { locationId: string; productId: string; skuId?: string | null; quantity: number; unit?: string; type: InventoryTransactionType; referenceType?: string; referenceId?: string; referenceLineId?: string; batchNo?: string; note?: string }) {
    const location = await tx.stockLocation.findFirst({ where: { id: input.locationId, active: true, warehouse: { organizationId: user.organizationId, active: true } }, include: { warehouse: true } });
    if (!location) throw new BadRequestException('库位不存在或不可用');
    const product = await tx.product.findFirst({ where: { id: input.productId, organizationId: user.organizationId, deletedAt: null } });
    if (!product) throw new BadRequestException('产品不存在');
    if (input.skuId) {
      const sku = await tx.productSku.findFirst({ where: { id: input.skuId, productId: input.productId, active: true } });
      if (!sku) throw new BadRequestException('SKU 不属于当前产品或已停用');
    }
    const stockKey = `${input.productId}:${input.skuId ?? '-'}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${input.locationId}:${stockKey}`}))`;
    const balance = await tx.inventoryBalance.findUnique({ where: { locationId_stockKey: { locationId: input.locationId, stockKey } } });
    const before = Number(balance?.quantity ?? 0);
    const after = before + input.quantity;
    if (after < -0.000001) throw new BadRequestException(`库存不足，当前库存 ${before}`);
    if (after + 0.000001 < Number(balance?.reservedQuantity ?? 0)) throw new BadRequestException('调整后库存低于已预留数量');
    await tx.inventoryBalance.upsert({
      where: { locationId_stockKey: { locationId: input.locationId, stockKey } },
      update: { quantity: after, unit: input.unit ?? balance?.unit ?? product.unit },
      create: { organizationId: user.organizationId, warehouseId: location.warehouseId, locationId: input.locationId, productId: input.productId, skuId: input.skuId, stockKey, quantity: after, unit: input.unit ?? product.unit },
    });
    const transactionNo = await this.nextNumber(tx, user.organizationId, 'INVENTORY_TRANSACTION');
    return tx.inventoryTransaction.create({ data: { organizationId: user.organizationId, transactionNo, type: input.type, warehouseId: location.warehouseId, locationId: input.locationId, productId: input.productId, skuId: input.skuId, quantity: input.quantity, beforeQuantity: before, afterQuantity: after, unit: input.unit ?? balance?.unit ?? product.unit, referenceType: input.referenceType, referenceId: input.referenceId, referenceLineId: input.referenceLineId, batchNo: input.batchNo, note: input.note, operatorId: user.sub }, include: { warehouse: true, location: true, product: { select: { productNo: true, name: true } }, sku: { select: { skuCode: true, name: true } } } });
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
