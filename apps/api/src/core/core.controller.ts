import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CoreService } from './core.service';
import { CreateAttachmentDto, ListQueryDto, NextNumberDto } from './dto/core.dto';
import { AccessManagementService } from './access-management.service';
import { ChangePasswordDto, CreateRoleDto, CreateUserDto, ResetPasswordDto, UpdateProfileDto, UpdateRoleAccessDto, UpdateUserDto } from './dto/access-management.dto';

@Controller()
export class CoreController {
  constructor(private readonly core: CoreService, private readonly access: AccessManagementService) {}
  @Public() @Get('health') health() { return this.core.health(); }
  @Get('me') profile(@CurrentUser() user: AuthUser) { return this.core.profile(user); }
  @Get('me/menus') menus(@CurrentUser() user: AuthUser) { return this.core.menus(user); }
  @Patch('me/profile') updateProfile(@CurrentUser() user: AuthUser, @Body() input: UpdateProfileDto) { return this.access.updateProfile(user, input); }
  @Post('me/change-password') changePassword(@CurrentUser() user: AuthUser, @Body() input: ChangePasswordDto) { return this.access.changePassword(user, input); }
  @RequirePermissions('system.user.read') @Get('system/users') users(@CurrentUser() user: AuthUser, @Query() query: ListQueryDto) { return this.core.users(user, query); }
  @RequirePermissions('system.user.read') @Get('system/users/:id') user(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.access.detail(user, id); }
  @RequirePermissions('system.user.create') @Post('system/users') createUser(@CurrentUser() user: AuthUser, @Body() input: CreateUserDto) { return this.access.createUser(user, input); }
  @RequirePermissions('system.user.update') @Patch('system/users/:id') updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateUserDto) { return this.access.updateUser(user, id, input); }
  @RequirePermissions('system.user.update') @Post('system/users/:id/reset-password') resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: ResetPasswordDto) { return this.access.resetPassword(user, id, input); }
  @RequirePermissions('system.user.read') @Get('system/access-options') options(@CurrentUser() user: AuthUser) { return this.access.options(user); }
  @RequirePermissions('system.role.read') @Get('system/roles') roles(@CurrentUser() user: AuthUser) { return this.core.roles(user); }
  @RequirePermissions('system.role.read') @Get('system/roles/:id') role(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.access.roleDetail(user, id); }
  @RequirePermissions('system.role.manage') @Post('system/roles') createRole(@CurrentUser() user: AuthUser, @Body() input: CreateRoleDto) { return this.access.createRole(user, input); }
  @RequirePermissions('system.role.manage') @Patch('system/roles/:id/access') updateRole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateRoleAccessDto) { return this.access.updateRole(user, id, input); }
  @RequirePermissions('system.org.read') @Get('system/org-units') org(@CurrentUser() user: AuthUser) { return this.core.organization(user); }
  @RequirePermissions('system.dict.manage') @Get('system/dictionaries') dictionaries(@CurrentUser() user: AuthUser): Promise<unknown> { return this.core.dictionaries(user); }
  @RequirePermissions('system.audit.read') @Get('system/audit-logs') audit(@CurrentUser() user: AuthUser, @Query() query: ListQueryDto): Promise<unknown> { return this.core.auditLogs(user, query); }
  @Post('system/business-numbers/next') nextNumber(@CurrentUser() user: AuthUser, @Body() input: NextNumberDto) { return this.core.nextNumber(user, input.code); }
  @RequirePermissions('system.attachment.create') @Post('system/attachments') attachment(@CurrentUser() user: AuthUser, @Body() input: CreateAttachmentDto) { return this.core.registerAttachment(user, input); }
}
