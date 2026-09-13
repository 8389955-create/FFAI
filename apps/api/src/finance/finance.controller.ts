import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CreateExpenseDto, CreatePayrollDto, FinanceListQueryDto, PayExpenseDto, PayPayrollDto, RecordMoneyDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @RequirePermissions('finance.dashboard.read') @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) { return this.finance.dashboard(user); }
  @RequirePermissions('finance.receivable.read') @Get('receivables') receivables(@CurrentUser() user: AuthUser, @Query() query: FinanceListQueryDto) { return this.finance.receivables(user, query); }
  @RequirePermissions('finance.receivable.collect') @Post('receivables/sync') syncReceivables(@CurrentUser() user: AuthUser) { return this.finance.syncReceivables(user); }
  @RequirePermissions('finance.receivable.collect') @Post('receivables/:id/receipts') collect(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: RecordMoneyDto) { return this.finance.collect(user, id, input); }

  @RequirePermissions('finance.payable.read') @Get('payables') payables(@CurrentUser() user: AuthUser, @Query() query: FinanceListQueryDto) { return this.finance.payables(user, query); }
  @RequirePermissions('finance.payable.pay') @Post('payables/sync') syncPayables(@CurrentUser() user: AuthUser) { return this.finance.syncPayables(user); }
  @RequirePermissions('finance.payable.pay') @Post('payables/:id/payments') paySupplier(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: RecordMoneyDto) { return this.finance.paySupplier(user, id, input); }

  @RequirePermissions('finance.expense.read') @Get('expenses') expenses(@CurrentUser() user: AuthUser, @Query() query: FinanceListQueryDto) { return this.finance.expenses(user, query); }
  @RequirePermissions('finance.expense.create') @Post('expenses') createExpense(@CurrentUser() user: AuthUser, @Body() input: CreateExpenseDto) { return this.finance.createExpense(user, input); }
  @RequirePermissions('finance.expense.create') @Post('expenses/:id/submit') submitExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.finance.submitExpense(user, id); }
  @RequirePermissions('finance.expense.approve') @Post('expenses/:id/approve') approveExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.finance.approveExpense(user, id); }
  @RequirePermissions('finance.expense.approve') @Post('expenses/:id/reject') rejectExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.finance.rejectExpense(user, id); }
  @RequirePermissions('finance.expense.pay') @Post('expenses/:id/pay') payExpense(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: PayExpenseDto) { return this.finance.payExpense(user, id, input); }

  @RequirePermissions('finance.payroll.read') @Get('payroll') payroll(@CurrentUser() user: AuthUser, @Query() query: FinanceListQueryDto) { return this.finance.payroll(user, query); }
  @RequirePermissions('finance.payroll.manage') @Get('employees') employees(@CurrentUser() user: AuthUser) { return this.finance.employees(user); }
  @RequirePermissions('finance.payroll.manage') @Post('payroll') createPayroll(@CurrentUser() user: AuthUser, @Body() input: CreatePayrollDto) { return this.finance.createPayroll(user, input); }
  @RequirePermissions('finance.payroll.manage') @Post('payroll/:id/confirm') confirmPayroll(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.finance.confirmPayroll(user, id); }
  @RequirePermissions('finance.payroll.pay') @Post('payroll/:id/pay') payPayroll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: PayPayrollDto) { return this.finance.payPayroll(user, id, input); }
}
