import { DesignStatus, ProjectMemberRole, ProjectStatus } from '@ffai/database';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ProjectListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class CreateProjectDto {
  @IsString() customerId!: string;
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedBudget?: number;
  @IsOptional() @IsDateString() expectedDeliveryAt?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() orgUnitId?: string;
  @IsOptional() @IsString() @MaxLength(3000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class CreateProjectSpaceDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(60) roomType?: string;
  @IsOptional() @IsString() @MaxLength(30) floor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lengthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) widthMm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) heightMm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) areaSqm?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() sort?: number;
}

export class AddProjectMemberDto {
  @IsString() userId!: string;
  @IsEnum(ProjectMemberRole) role!: ProjectMemberRole;
}

export class CreateDesignVersionDto {
  @IsString() @MinLength(1) @MaxLength(150) title!: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsString() attachmentId?: string;
}

export class ReviewDesignVersionDto {
  @IsEnum(DesignStatus) status!: DesignStatus;
  @IsOptional() @IsString() @MaxLength(1000) reviewNote?: string;
}

