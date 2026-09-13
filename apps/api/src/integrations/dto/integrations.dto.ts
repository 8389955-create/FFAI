import { IntegrationStatus } from '@ffai/database';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateChannelDto { @IsString() @MinLength(1) @MaxLength(120) name!: string; @IsOptional() @IsEnum(IntegrationStatus) status?: IntegrationStatus; @IsOptional() @IsObject() config?: Record<string, unknown>; }
export class CreateApiClientDto { @IsString() @MinLength(1) @MaxLength(120) name!: string; @IsOptional() @IsString() channelId?: string; @IsArray() @IsString({ each: true }) scopes!: string[]; }
export class ToggleDto { @IsBoolean() active!: boolean; }
export class CreateWebhookDto { @IsString() @MinLength(1) @MaxLength(120) name!: string; @IsUrl({ require_tld: false }) @MaxLength(1000) url!: string; @IsOptional() @IsString() channelId?: string; @IsArray() @IsString({ each: true }) eventTypes!: string[]; }
export class EnqueueEventDto { @IsString() @MinLength(1) @MaxLength(120) eventType!: string; @IsString() @MinLength(1) @MaxLength(80) aggregateType!: string; @IsString() @MinLength(1) @MaxLength(120) aggregateId!: string; @IsObject() payload!: Record<string, unknown>; }
export class IntegrationListQueryDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; }
