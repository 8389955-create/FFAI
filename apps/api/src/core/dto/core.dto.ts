import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED', 'LOCKED', 'PENDING']) status?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() orgUnitId?: string;
}

export class NextNumberDto {
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
}

export class CreateAttachmentDto {
  @IsString() @MinLength(1) @MaxLength(255) originalName!: string;
  @IsString() @MinLength(1) @MaxLength(100) contentType!: string;
  @IsInt() @Min(1) @Max(104857600) size!: number;
  @IsOptional() @IsString() @MaxLength(80) businessType?: string;
  @IsOptional() @IsString() @MaxLength(100) businessId?: string;
}
