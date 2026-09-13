import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AccessTokenGuard } from './auth/guards/access-token.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { AuditInterceptor } from './common/audit.interceptor';
import { CoreModule } from './core/core.module';
import { CrmModule } from './crm/crm.module';
import { ProjectsModule } from './projects/projects.module';
import { PimModule } from './pim/pim.module';
import { CommercialModule } from './commercial/commercial.module';
import { OmsModule } from './oms/oms.module';
import { ScmModule } from './scm/scm.module';
import { MesModule } from './mes/mes.module';
import { WmsModule } from './wms/wms.module';
import { FinanceModule } from './finance/finance.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { TasksModule } from './tasks/tasks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }), PrismaModule, AuthModule, CoreModule, CrmModule, ProjectsModule, PimModule, CommercialModule, OmsModule, ScmModule, MesModule, WmsModule, FinanceModule, FulfillmentModule, TasksModule, AnalyticsModule, IntegrationsModule],
  providers: [
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
