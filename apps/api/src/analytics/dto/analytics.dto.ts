import { InsightStatus } from '@ffai/database';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TrendQueryDto { @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(365) days = 30; }
export class InsightQueryDto { @IsOptional() @IsEnum(InsightStatus) status?: InsightStatus; }
