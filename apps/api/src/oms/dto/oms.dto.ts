import { SalesOrderStatus } from '@ffai/database';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class OrderListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page=1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize=20;
  @IsOptional() @IsString() @MaxLength(100) keyword?:string;
  @IsOptional() @IsEnum(SalesOrderStatus) status?:SalesOrderStatus;
}
export class CreateOrderDto {
  @IsString() contractId!:string;
  @IsOptional() @IsString() @MaxLength(500) deliveryAddress?:string;
  @IsOptional() @IsDateString() expectedDeliveryAt?:string;
  @IsOptional() @IsString() @MaxLength(3000) notes?:string;
}
export class TransitionOrderDto {
  @IsEnum(SalesOrderStatus) status!:SalesOrderStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?:string;
}
