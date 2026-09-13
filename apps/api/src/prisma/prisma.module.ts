import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { FieldPermissionService } from '../common/field-permission.service';

@Global()
@Module({ providers: [PrismaService, FieldPermissionService], exports: [PrismaService, FieldPermissionService] })
export class PrismaModule {}
