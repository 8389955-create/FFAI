import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrderDto, OrderListQueryDto, TransitionOrderDto } from './dto/oms.dto';

@Injectable()
export class OmsService {
  constructor(private readonly prisma:PrismaService){}
  async availableContracts(user:AuthUser){
    return this.prisma.contract.findMany({where:{organizationId:user.organizationId,status:'ACTIVE',salesOrder:null,...this.contractScope(user)},orderBy:{updatedAt:'desc'},include:{customer:{select:{id:true,name:true,customerNo:true}},project:{select:{id:true,name:true,projectNo:true}},quotation:{select:{id:true,quotationNo:true,ownerId:true}}}});
  }
  async list(user:AuthUser,query:OrderListQueryDto){
    const scope=this.scope(user);const where:Prisma.SalesOrderWhereInput={organizationId:user.organizationId,...scope,...(query.status?{status:query.status}:{}),...(query.keyword?{OR:[{orderNo:{contains:query.keyword,mode:'insensitive'}},{title:{contains:query.keyword,mode:'insensitive'}},{customer:{name:{contains:query.keyword,mode:'insensitive'}}}]}:{})};
    const [items,total,groups]=await this.prisma.$transaction([
      this.prisma.salesOrder.findMany({where,skip:(query.page-1)*query.pageSize,take:query.pageSize,orderBy:{updatedAt:'desc'},include:{customer:{select:{id:true,name:true,customerNo:true}},project:{select:{id:true,name:true,projectNo:true}},contract:{select:{id:true,contractNo:true}},owner:{select:{displayName:true}},_count:{select:{items:true}}}}),
      this.prisma.salesOrder.count({where}),this.prisma.salesOrder.groupBy({by:['status'],where:{organizationId:user.organizationId,...scope},_count:true,orderBy:{status:'asc'}})
    ]);return{items,total,page:query.page,pageSize:query.pageSize,summary:Object.fromEntries(groups.map(g=>[g.status,g._count]))};
  }
  async detail(user:AuthUser,id:string){
    const order=await this.prisma.salesOrder.findFirst({where:{id,organizationId:user.organizationId,...this.scope(user)},include:{customer:{select:{id:true,name:true,customerNo:true,phone:true}},project:{select:{id:true,name:true,projectNo:true}},contract:{select:{id:true,contractNo:true,status:true}},owner:{select:{id:true,displayName:true}},items:{orderBy:[{sort:'asc'},{lineNo:'asc'}],include:{product:{select:{productNo:true,name:true}},sku:{select:{skuCode:true,name:true}}}},statusHistory:{orderBy:{createdAt:'desc'},include:{changedBy:{select:{displayName:true}}}}}});if(!order)throw new NotFoundException('订单不存在或不在当前数据范围内');return order;
  }
  async create(user:AuthUser,input:CreateOrderDto){
    const contract=await this.prisma.contract.findFirst({where:{id:input.contractId,organizationId:user.organizationId,status:'ACTIVE',...this.contractScope(user)},include:{customer:true,quotation:{include:{items:true}}}});if(!contract||!contract.quotation)throw new BadRequestException('合同不存在、未生效或无来源报价');
    return this.prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`contract-order:${contract.id}`}))`;const exists=await tx.salesOrder.findUnique({where:{contractId:contract.id}});if(exists)return exists;const orderNo=await this.nextNumber(tx,user.organizationId,'ORDER');const order=await tx.salesOrder.create({data:{organizationId:user.organizationId,orderNo,contractId:contract.id,customerId:contract.customerId,projectId:contract.projectId,title:contract.title.replace('合同','订单'),totalAmount:contract.totalAmount,deliveryAddress:input.deliveryAddress||contract.customer.address,expectedDeliveryAt:input.expectedDeliveryAt?new Date(input.expectedDeliveryAt):undefined,notes:input.notes,ownerId:contract.quotation!.ownerId,createdById:user.sub,items:{create:contract.quotation!.items.map(item=>({lineNo:item.lineNo,productId:item.productId,skuId:item.skuId,description:item.description,specification:item.specification,quantity:item.quantity,unit:item.unit,unitPrice:item.unitPrice,amount:item.amount,sort:item.sort}))}}});await tx.salesOrderStatusHistory.create({data:{salesOrderId:order.id,toStatus:'DRAFT',note:'由生效合同生成',changedById:user.sub}});return order;});
  }
  async transition(user:AuthUser,id:string,input:TransitionOrderDto){
    const order=await this.detail(user,id);const allowed:Record<string,string[]>={DRAFT:['CONFIRMED','CANCELLED'],CONFIRMED:['PLANNING','CANCELLED'],PLANNING:['IN_PRODUCTION','CANCELLED'],IN_PRODUCTION:['READY_TO_SHIP'],READY_TO_SHIP:['SHIPPED'],SHIPPED:['INSTALLED'],INSTALLED:['COMPLETED']};if(!allowed[order.status]?.includes(input.status))throw new BadRequestException(`不能从 ${order.status} 变更为 ${input.status}`);if(input.status==='CONFIRMED'&&!user.permissions.includes('oms.order.confirm'))throw new ForbiddenException('当前角色无权确认订单');return this.prisma.$transaction(async tx=>{const updated=await tx.salesOrder.update({where:{id},data:{status:input.status,...(input.status==='CONFIRMED'?{confirmedAt:new Date()}: {})}});await tx.salesOrderStatusHistory.create({data:{salesOrderId:id,fromStatus:order.status,toStatus:input.status,note:input.note,changedById:user.sub}});return updated;});
  }
  private scope(user:AuthUser):Prisma.SalesOrderWhereInput{if(user.dataScopes.includes('ALL')||user.dataScopes.includes('COMPANY'))return{};return{OR:[{ownerId:user.sub},{project:{members:{some:{userId:user.sub}}}}]};}
  private contractScope(user:AuthUser):Prisma.ContractWhereInput{if(user.dataScopes.includes('ALL')||user.dataScopes.includes('COMPANY'))return{};return{OR:[{quotation:{ownerId:user.sub}},{project:{members:{some:{userId:user.sub}}}}]};}
  private async nextNumber(tx:Prisma.TransactionClient,organizationId:string,code:string){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`;const rule=await tx.businessNumberRule.findUnique({where:{organizationId_code:{organizationId,code}}});if(!rule||!rule.active)throw new NotFoundException(`业务编号规则 ${code} 不存在`);const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','');const next=rule.currentDate===date?rule.currentValue+1:1;await tx.businessNumberRule.update({where:{id:rule.id},data:{currentDate:date,currentValue:next}});return`${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength,'0')}`;}
}
