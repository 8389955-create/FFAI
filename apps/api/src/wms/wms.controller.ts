import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AdjustStockDto, CreateLocationDto, CreateWarehouseDto, ProductionReceiptDto, PurchaseReceiptDto, StockIssueDto, TransferStockDto, WmsListQueryDto } from './dto/wms.dto';
import { WmsService } from './wms.service';

@Controller('wms')
export class WmsController {
  constructor(private readonly wms: WmsService) {}

  @RequirePermissions('wms.warehouse.read') @Get('warehouses')
  warehouses(@CurrentUser() user: AuthUser) { return this.wms.warehouses(user); }

  @RequirePermissions('wms.warehouse.manage') @Post('warehouses')
  createWarehouse(@CurrentUser() user: AuthUser, @Body() input: CreateWarehouseDto) { return this.wms.createWarehouse(user, input); }

  @RequirePermissions('wms.warehouse.manage') @Post('warehouses/:id/locations')
  createLocation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateLocationDto) { return this.wms.createLocation(user, id, input); }

  @RequirePermissions('wms.inventory.read') @Get('inventory')
  inventory(@CurrentUser() user: AuthUser, @Query() query: WmsListQueryDto) { return this.wms.inventory(user, query); }

  @RequirePermissions('wms.inventory.read') @Get('transactions')
  transactions(@CurrentUser() user: AuthUser, @Query() query: WmsListQueryDto) { return this.wms.transactions(user, query); }

  @RequirePermissions('wms.stock.receive') @Get('receivable-purchase-items')
  receivablePurchaseItems(@CurrentUser() user: AuthUser) { return this.wms.receivablePurchaseItems(user); }

  @RequirePermissions('wms.stock.receive') @Get('receivable-production-items')
  receivableProductionItems(@CurrentUser() user: AuthUser) { return this.wms.receivableProductionItems(user); }

  @RequirePermissions('wms.stock.receive') @Post('receipts/purchase')
  receivePurchase(@CurrentUser() user: AuthUser, @Body() input: PurchaseReceiptDto) { return this.wms.receivePurchase(user, input); }

  @RequirePermissions('wms.stock.receive') @Post('receipts/production')
  receiveProduction(@CurrentUser() user: AuthUser, @Body() input: ProductionReceiptDto) { return this.wms.receiveProduction(user, input); }

  @RequirePermissions('wms.stock.issue') @Post('issues')
  issue(@CurrentUser() user: AuthUser, @Body() input: StockIssueDto) { return this.wms.issue(user, input); }

  @RequirePermissions('wms.stock.transfer') @Post('transfers')
  transfer(@CurrentUser() user: AuthUser, @Body() input: TransferStockDto) { return this.wms.transfer(user, input); }

  @RequirePermissions('wms.stock.adjust') @Post('adjustments')
  adjust(@CurrentUser() user: AuthUser, @Body() input: AdjustStockDto) { return this.wms.adjust(user, input); }
}
