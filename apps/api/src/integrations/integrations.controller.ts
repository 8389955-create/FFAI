import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateApiClientDto, CreateWebhookDto, EnqueueEventDto, IntegrationListQueryDto, ToggleDto, UpdateChannelDto } from './dto/integrations.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}
  @RequirePermissions('integration.read') @Get('channels') channels(@CurrentUser() user: AuthUser) { return this.service.channels(user); }
  @RequirePermissions('integration.manage') @Patch('channels/:type') updateChannel(@CurrentUser() user: AuthUser, @Param('type') type: string, @Body() input: UpdateChannelDto) { return this.service.updateChannel(user, type, input); }
  @RequirePermissions('integration.read') @Get('clients') clients(@CurrentUser() user: AuthUser) { return this.service.clients(user); }
  @RequirePermissions('integration.client.manage') @Post('clients') createClient(@CurrentUser() user: AuthUser, @Body() input: CreateApiClientDto) { return this.service.createClient(user, input); }
  @RequirePermissions('integration.client.manage') @Patch('clients/:id') toggleClient(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: ToggleDto) { return this.service.toggleClient(user, id, input); }
  @RequirePermissions('integration.read') @Get('webhooks') webhooks(@CurrentUser() user: AuthUser) { return this.service.webhooks(user); }
  @RequirePermissions('integration.webhook.manage') @Post('webhooks') createWebhook(@CurrentUser() user: AuthUser, @Body() input: CreateWebhookDto) { return this.service.createWebhook(user, input); }
  @RequirePermissions('integration.webhook.manage') @Patch('webhooks/:id') toggleWebhook(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: ToggleDto) { return this.service.toggleWebhook(user, id, input); }
  @RequirePermissions('integration.webhook.manage') @Post('events') enqueue(@CurrentUser() user: AuthUser, @Body() input: EnqueueEventDto) { return this.service.enqueue(user, input); }
  @RequirePermissions('integration.read') @Get('outbox') outbox(@CurrentUser() user: AuthUser, @Query() query: IntegrationListQueryDto) { return this.service.outbox(user, query); }
  @RequirePermissions('integration.webhook.dispatch') @Post('dispatch') dispatch(@CurrentUser() user: AuthUser) { return this.service.dispatch(user); }
  @Public() @Get('open/catalog') catalog(@Req() request: Request) { return this.service.publicCatalog(request); }
  @Public() @Get('open/orders/:orderNo') order(@Req() request: Request, @Param('orderNo') orderNo: string) { return this.service.publicOrder(request, orderNo); }
  @Public() @Post('open/events') publicEvent(@Req() request: Request, @Body() input: EnqueueEventDto) { return this.service.publicEnqueue(request, input); }
}
