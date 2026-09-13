import { InventoryTransactionType, WarehouseType } from '@ffai/database';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class WmsListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsEnum(InventoryTransactionType) type?: InventoryTransactionType;
}

export class CreateWarehouseDto {
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsEnum(WarehouseType) type?: WarehouseType;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
}

export class CreateLocationDto {
  @IsString() @MinLength(1) @MaxLength(60) code!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) zone?: string;
}

export class PurchaseReceiptDto {
  @IsString() purchaseOrderItemId!: string;
  @IsString() locationId!: string;
  @Type(() => Number) @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() @MaxLength(80) batchNo?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ProductionReceiptDto {
  @IsString() productionOrderItemId!: string;
  @IsString() locationId!: string;
  @Type(() => Number) @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() @MaxLength(80) batchNo?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class StockIssueDto {
  @IsString() locationId!: string;
  @IsString() productId!: string;
  @IsOptional() @IsString() skuId?: string;
  @Type(() => Number) @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsString() @MaxLength(50) referenceType?: string;
  @IsOptional() @IsString() @MaxLength(100) referenceId?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class TransferStockDto {
  @IsString() fromLocationId!: string;
  @IsString() toLocationId!: string;
  @IsString() productId!: string;
  @IsOptional() @IsString() skuId?: string;
  @Type(() => Number) @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AdjustStockDto {
  @IsString() locationId!: string;
  @IsString() productId!: string;
  @IsOptional() @IsString() skuId?: string;
  @Type(() => Number) @IsNumber() quantityChange!: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() confirm?: boolean;
}
