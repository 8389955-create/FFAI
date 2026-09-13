import { Body,Controller,Get,Param,Post,Query } from '@nestjs/common';import { CurrentUser } from '../auth/decorators/current-user.decorator';import { RequirePermissions } from '../auth/decorators/permissions.decorator';import type { AuthUser } from '../auth/auth.types';import { CreateOrderDto,OrderListQueryDto,TransitionOrderDto } from './dto/oms.dto';import { OmsService } from './oms.service';
@Controller('oms') export class OmsController{constructor(private readonly oms:OmsService){}
@RequirePermissions('oms.order.read') @Get('available-contracts') contracts(@CurrentUser()u:AuthUser){return this.oms.availableContracts(u)}
@RequirePermissions('oms.order.read') @Get('orders') list(@CurrentUser()u:AuthUser,@Query()q:OrderListQueryDto){return this.oms.list(u,q)}
@RequirePermissions('oms.order.read') @Get('orders/:id') detail(@CurrentUser()u:AuthUser,@Param('id')id:string){return this.oms.detail(u,id)}
@RequirePermissions('oms.order.create') @Post('orders') create(@CurrentUser()u:AuthUser,@Body()i:CreateOrderDto){return this.oms.create(u,i)}
@RequirePermissions('oms.order.update') @Post('orders/:id/transition') transition(@CurrentUser()u:AuthUser,@Param('id')id:string,@Body()i:TransitionOrderDto){return this.oms.transition(u,id,i)} }
