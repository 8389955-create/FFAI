import { ActivityType, CustomerStatus, CustomerType, LeadStatus } from '@ffai/database';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CrmListQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
}

export class CreateCustomerDto {
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
  @IsOptional() @IsString() @MaxLength(100) shortName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(80) source?: string;
  @IsOptional() @IsString() @MaxLength(30) level?: string;
  @IsOptional() @IsString() @MaxLength(50) province?: string;
  @IsOptional() @IsString() @MaxLength(50) city?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() orgUnitId?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CreateContactDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(100) wechat?: string;
  @IsOptional() isPrimary?: boolean;
}

export class CreateActivityDto {
  @IsEnum(ActivityType) type!: ActivityType;
  @IsString() @MinLength(1) @MaxLength(5000) content!: string;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
}

export class CreateLeadDto {
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(100) contactName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(80) source?: string;
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsString() @MaxLength(2000) intentSummary?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedValue?: number;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() orgUnitId?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @IsOptional() @IsString() @MaxLength(500) lostReason?: string;
}
