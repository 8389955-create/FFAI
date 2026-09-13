import { IntegrationChannelType, ProductAssetType, ProductStatus, ProductType } from '@ffai/database';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ProductListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsEnum(ProductType) type?: ProductType;
  @IsOptional() @IsString() categoryId?: string;
}

export class CreateProductCategoryDto {
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() sort?: number;
}

export class CreateProductDto {
  @IsOptional() @IsString() @MaxLength(80) productNo?: string;
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(100) shortName?: string;
  @IsOptional() @IsEnum(ProductType) type?: ProductType;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsString() @MaxLength(100) collection?: string;
  @IsOptional() @IsString() @MaxLength(150) materialNameCn?: string;
  @IsOptional() @IsString() @MaxLength(150) materialNameEn?: string;
  @IsOptional() @IsString() @MaxLength(100) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lengthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) widthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) heightMm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) weightKg?: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) factoryPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) priceMultiplier?: number;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() publicVisible?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class CreateProductSkuDto {
  @IsString() @MinLength(1) @MaxLength(100) skuCode!: string;
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lengthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) widthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) heightMm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) factoryPrice?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class AddProductAssetDto {
  @IsString() attachmentId!: string;
  @IsEnum(ProductAssetType) type!: ProductAssetType;
  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @IsOptional() @Type(() => Number) @IsInt() sort?: number;
  @IsOptional() @IsBoolean() approved?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ApplyProductTemplateDto {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(100) shortName?: string;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsString() @MaxLength(100) collection?: string;
  @IsOptional() @IsString() @MaxLength(150) materialNameCn?: string;
  @IsOptional() @IsString() @MaxLength(150) materialNameEn?: string;
  @IsOptional() @IsString() @MaxLength(100) color?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lengthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) widthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) heightMm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) factoryPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) priceMultiplier?: number;
}

export class QueueProductSyncDto {
  @IsArray() @ArrayMinSize(1) @IsEnum(IntegrationChannelType, { each: true }) channels!: IntegrationChannelType[];
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
