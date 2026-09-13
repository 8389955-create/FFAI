import { AlertStatus, WorkTaskPriority, WorkTaskStatus } from '@ffai/database';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class TaskListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsEnum(WorkTaskStatus) taskStatus?: WorkTaskStatus;
  @IsOptional() @IsEnum(WorkTaskPriority) priority?: WorkTaskPriority;
  @IsOptional() overdue?: boolean;
}

export class AlertListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsEnum(AlertStatus) alertStatus?: AlertStatus;
}

export class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(WorkTaskPriority) priority?: WorkTaskPriority;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsString() assigneeId!: string;
  @IsOptional() @IsString() @MaxLength(60) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(100) sourceId?: string;
  @IsOptional() @IsString() @MaxLength(100) sourceNo?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(WorkTaskStatus) status?: WorkTaskStatus;
  @IsOptional() @IsEnum(WorkTaskPriority) priority?: WorkTaskPriority;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() reminderAt?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateAlertDto {
  @IsEnum(AlertStatus) status!: AlertStatus;
}
