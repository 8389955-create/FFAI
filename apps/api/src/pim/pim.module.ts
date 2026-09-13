import { Module } from '@nestjs/common';
import { PimController } from './pim.controller';
import { PimService } from './pim.service';

@Module({ controllers: [PimController], providers: [PimService] })
export class PimModule {}
