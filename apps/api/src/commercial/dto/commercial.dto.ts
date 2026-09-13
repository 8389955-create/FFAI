import { ContractStatus, QuotationStatus } from '@ffai/database';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class QuotationListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsEnum(QuotationStatus) status?: QuotationStatus;
}

export class CreateQuotationDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() projectId?: string;
  @IsString() @MinLength(1) @MaxLength(180) title!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) taxRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(3000) notes?: string;
  @IsOptional() @IsString() @MaxLength(5000) terms?: string;
}

export class UpdateQuotationDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180) title?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) taxRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(3000) notes?: string;
  @IsOptional() @IsString() @MaxLength(5000) terms?: string;
}

export class CreateQuotationItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() skuId?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(200) materialName?: string;
  @IsOptional() @IsString() @MaxLength(300) specification?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @Type(() => Number) @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) discountRate?: number;
}

export class UpdateQuotationItemDto extends PartialType(CreateQuotationItemDto) {}

export class CommercialExportQueryDto { @IsOptional() @IsIn(['docx', 'png']) format: 'docx' | 'png' = 'docx'; }

export class TransitionQuotationDto { @IsEnum(QuotationStatus) status!: QuotationStatus; }
export class TransitionContractDto { @IsEnum(ContractStatus) status!: ContractStatus; }
