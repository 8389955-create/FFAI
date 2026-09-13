import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CrmService } from './crm.service';
import { CreateActivityDto, CreateContactDto, CreateCustomerDto, CreateLeadDto, CrmListQueryDto, UpdateCustomerDto, UpdateLeadDto } from './dto/crm.dto';

@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}
  @RequirePermissions('crm.customer.read') @Get('customers') listCustomers(@CurrentUser() user: AuthUser, @Query() query: CrmListQueryDto) { return this.crm.listCustomers(user, query); }
  @RequirePermissions('crm.customer.read') @Get('customers/:id') customer(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.crm.customer(user, id); }
  @RequirePermissions('crm.customer.create') @Post('customers') createCustomer(@CurrentUser() user: AuthUser, @Body() input: CreateCustomerDto) { return this.crm.createCustomer(user, input); }
  @RequirePermissions('crm.customer.update') @Patch('customers/:id') updateCustomer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateCustomerDto) { return this.crm.updateCustomer(user, id, input); }
  @RequirePermissions('crm.customer.update') @Post('customers/:id/contacts') addContact(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateContactDto) { return this.crm.addContact(user, id, input); }
  @RequirePermissions('crm.activity.create') @Post('customers/:id/activities') addCustomerActivity(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateActivityDto) { return this.crm.addCustomerActivity(user, id, input); }
  @RequirePermissions('crm.lead.read') @Get('leads') listLeads(@CurrentUser() user: AuthUser, @Query() query: CrmListQueryDto) { return this.crm.listLeads(user, query); }
  @RequirePermissions('crm.lead.read') @Get('leads/:id') lead(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.crm.lead(user, id); }
  @RequirePermissions('crm.lead.create') @Post('leads') createLead(@CurrentUser() user: AuthUser, @Body() input: CreateLeadDto) { return this.crm.createLead(user, input); }
  @RequirePermissions('crm.lead.update') @Patch('leads/:id') updateLead(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateLeadDto) { return this.crm.updateLead(user, id, input); }
  @RequirePermissions('crm.activity.create') @Post('leads/:id/activities') addLeadActivity(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateActivityDto) { return this.crm.addLeadActivity(user, id, input); }
  @RequirePermissions('crm.lead.update', 'crm.customer.create') @Post('leads/:id/convert') convertLead(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.crm.convertLead(user, id); }
}

