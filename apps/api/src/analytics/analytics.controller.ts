import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AnalyticsService } from './analytics.service';
import { InsightQueryDto, TrendQueryDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @RequirePermissions('analytics.dashboard.read') @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) { return this.service.dashboard(user); }
  @RequirePermissions('analytics.dashboard.read') @Get('trends') trends(@CurrentUser() user: AuthUser, @Query() query: TrendQueryDto) { return this.service.trends(user, query); }
  @RequirePermissions('analytics.snapshot.generate') @Post('snapshots') snapshot(@CurrentUser() user: AuthUser) { return this.service.snapshot(user); }
  @RequirePermissions('ai.insight.read') @Get('insights') insights(@CurrentUser() user: AuthUser, @Query() query: InsightQueryDto) { return this.service.insights(user, query); }
  @RequirePermissions('ai.insight.generate') @Post('insights/generate') generate(@CurrentUser() user: AuthUser) { return this.service.generateInsights(user); }
  @RequirePermissions('ai.insight.manage') @Patch('insights/:id/dismiss') dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.dismissInsight(user, id); }
}
