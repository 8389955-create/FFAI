import { ExpenseStatus, PaymentMethod, PayrollStatus, SettlementStatus } from '@ffai/database';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class FinanceListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsEnum(SettlementStatus) settlementStatus?: SettlementStatus;
  @IsOptional() @IsEnum(ExpenseStatus) expenseStatus?: ExpenseStatus;
  @IsOptional() @IsEnum(PayrollStatus) payrollStatus?: PayrollStatus;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}$/) period?: string;
}

export class RecordMoneyDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsString() @MaxLength(120) transactionRef?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class CreateExpenseDto {
  @IsString() @MinLength(1) @MaxLength(80) category!: string;
  @IsString() @MinLength(1) @MaxLength(300) description!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxAmount?: number;
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class PayExpenseDto {
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(120) transactionRef?: string;
}

export class CreatePayrollDto {
  @IsString() employeeId!: string;
  @IsString() @Matches(/^\d{4}-\d{2}$/) period!: string;
  @Type(() => Number) @IsNumber() @Min(0) baseAmount!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bonusAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) deductionAmount?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class PayPayrollDto {
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(120) transactionRef?: string;
}
