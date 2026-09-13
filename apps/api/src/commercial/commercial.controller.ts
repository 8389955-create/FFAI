import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CommercialService } from './commercial.service';
import { CommercialExportQueryDto, CreateQuotationDto, CreateQuotationItemDto, QuotationListQueryDto, TransitionContractDto, TransitionQuotationDto, UpdateQuotationDto, UpdateQuotationItemDto } from './dto/commercial.dto';

@Controller('commercial')
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}
  @RequirePermissions('commercial.quote.read') @Get('quotations') list(@CurrentUser() user: AuthUser, @Query() query: QuotationListQueryDto) { return this.commercial.list(user, query); }
  @RequirePermissions('commercial.quote.read') @Get('quotations/:id') detail(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.commercial.detail(user, id); }
  @RequirePermissions('commercial.quote.read') @Get('quotations/:id/export') async exportQuotation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: CommercialExportQueryDto, @Res({ passthrough: true }) response: Response) { const file = await this.commercial.exportQuotation(user, id, query.format); response.setHeader('Content-Type', file.contentType); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`); return new StreamableFile(file.buffer); }
  @RequirePermissions('commercial.quote.create') @Post('quotations') create(@CurrentUser() user: AuthUser, @Body() input: CreateQuotationDto) { return this.commercial.create(user, input); }
  @RequirePermissions('commercial.quote.update') @Patch('quotations/:id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateQuotationDto) { return this.commercial.update(user, id, input); }
  @RequirePermissions('commercial.quote.update') @Post('quotations/:id/items') addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateQuotationItemDto) { return this.commercial.addItem(user, id, input); }
  @RequirePermissions('commercial.quote.update') @Patch('quotations/:id/items/:itemId') updateItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string, @Body() input: UpdateQuotationItemDto) { return this.commercial.updateItem(user, id, itemId, input); }
  @RequirePermissions('commercial.quote.update') @Delete('quotations/:id/items/:itemId') deleteItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) { return this.commercial.deleteItem(user, id, itemId); }
  @RequirePermissions('commercial.quote.update') @Post('quotations/:id/submit') submit(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.commercial.submit(user, id); }
  @RequirePermissions('commercial.quote.approve') @Post('quotations/:id/approve') approve(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.commercial.approve(user, id); }
  @RequirePermissions('commercial.quote.update') @Post('quotations/:id/transition') transition(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: TransitionQuotationDto) { return this.commercial.transition(user, id, input); }
  @RequirePermissions('commercial.quote.update', 'commercial.contract.create') @Post('quotations/:id/contract') convertContract(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.commercial.convertContract(user, id); }
  @RequirePermissions('commercial.contract.update') @Post('contracts/:id/transition') transitionContract(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: TransitionContractDto) { return this.commercial.transitionContract(user, id, input); }
  @RequirePermissions('commercial.quote.read') @Get('contracts/:id/export') async exportContract(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: CommercialExportQueryDto, @Res({ passthrough: true }) response: Response) { const file = await this.commercial.exportContract(user, id, query.format); response.setHeader('Content-Type', file.contentType); response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`); return new StreamableFile(file.buffer); }
}
