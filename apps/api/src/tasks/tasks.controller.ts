import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AlertListQueryDto, CreateTaskDto, TaskListQueryDto, UpdateAlertDto, UpdateTaskDto } from './dto/tasks.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @RequirePermissions('task.read') @Get('dashboard') dashboard(@CurrentUser() user: AuthUser) { return this.service.dashboard(user); }
  @RequirePermissions('task.read') @Get('assignees') assignees(@CurrentUser() user: AuthUser) { return this.service.assignees(user); }
  @RequirePermissions('task.read') @Get() tasks(@CurrentUser() user: AuthUser, @Query() query: TaskListQueryDto) { return this.service.tasks(user, query); }
  @RequirePermissions('task.create') @Post() create(@CurrentUser() user: AuthUser, @Body() input: CreateTaskDto) { return this.service.createTask(user, input); }
  @RequirePermissions('task.manage') @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateTaskDto) { return this.service.updateTask(user, id, input); }
  @RequirePermissions('alert.read') @Get('alerts/list') alerts(@CurrentUser() user: AuthUser, @Query() query: AlertListQueryDto) { return this.service.alerts(user, query); }
  @RequirePermissions('alert.scan') @Post('alerts/scan') scan(@CurrentUser() user: AuthUser) { return this.service.scanAlerts(user); }
  @RequirePermissions('alert.manage') @Patch('alerts/:id') updateAlert(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateAlertDto) { return this.service.updateAlert(user, id, input); }
}
