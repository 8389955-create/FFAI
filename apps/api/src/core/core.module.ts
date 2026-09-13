import { Module } from '@nestjs/common';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { AccessManagementService } from './access-management.service';
@Module({ controllers: [CoreController], providers: [CoreService, AccessManagementService] })
export class CoreModule {}
