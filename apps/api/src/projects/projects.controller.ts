import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AddProjectMemberDto, CreateDesignVersionDto, CreateProjectDto, CreateProjectSpaceDto, ProjectListQueryDto, ReviewDesignVersionDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @RequirePermissions('project.read') @Get() list(@CurrentUser() user: AuthUser, @Query() query: ProjectListQueryDto) { return this.projects.list(user, query); }
  @RequirePermissions('project.read') @Get(':id') detail(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.projects.detail(user, id); }
  @RequirePermissions('project.create') @Post() create(@CurrentUser() user: AuthUser, @Body() input: CreateProjectDto) { return this.projects.create(user, input); }
  @RequirePermissions('project.update') @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateProjectDto) { return this.projects.update(user, id, input); }
  @RequirePermissions('project.space.manage') @Post(':id/spaces') addSpace(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateProjectSpaceDto) { return this.projects.addSpace(user, id, input); }
  @RequirePermissions('project.update') @Post(':id/members') addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: AddProjectMemberDto) { return this.projects.addMember(user, id, input); }
  @RequirePermissions('project.design.manage') @Post(':id/design-versions') createDesign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateDesignVersionDto) { return this.projects.createDesignVersion(user, id, input); }
  @RequirePermissions('project.design.manage') @Patch(':id/design-versions/:versionId') reviewDesign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('versionId') versionId: string, @Body() input: ReviewDesignVersionDto) { return this.projects.reviewDesignVersion(user, id, versionId, input); }
}

