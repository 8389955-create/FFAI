import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AddProductAssetDto, ApplyProductTemplateDto, CreateProductCategoryDto, CreateProductDto, CreateProductSkuDto, ProductListQueryDto, QueueProductSyncDto, UpdateProductDto } from './dto/pim.dto';
import { PimService } from './pim.service';

@Controller('pim')
export class PimController {
  constructor(private readonly pim: PimService) {}

  @RequirePermissions('pim.product.read') @Get('categories') categories(@CurrentUser() user: AuthUser) { return this.pim.categories(user); }
  @RequirePermissions('pim.category.manage') @Post('categories') createCategory(@CurrentUser() user: AuthUser, @Body() input: CreateProductCategoryDto) { return this.pim.createCategory(user, input); }
  @RequirePermissions('pim.product.read') @Get('product-templates') templates(@CurrentUser() user: AuthUser) { return this.pim.templates(user); }
  @RequirePermissions('pim.product.create') @Post('product-templates/:code/apply') applyTemplate(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body() input: ApplyProductTemplateDto) { return this.pim.applyTemplate(user, code, input); }
  @RequirePermissions('pim.product.read') @Get('products') list(@CurrentUser() user: AuthUser, @Query() query: ProductListQueryDto) { return this.pim.list(user, query); }
  @RequirePermissions('pim.product.read') @Get('products/:id') detail(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.pim.detail(user, id); }
  @RequirePermissions('pim.product.read') @Get('products/:id/channel-sync') channelSync(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.pim.channelSync(user, id); }
  @RequirePermissions('pim.product.publish') @Post('products/:id/channel-sync') queueChannelSync(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: QueueProductSyncDto) { return this.pim.queueChannelSync(user, id, input); }
  @RequirePermissions('pim.product.create') @Post('products') create(@CurrentUser() user: AuthUser, @Body() input: CreateProductDto) { return this.pim.create(user, input); }
  @RequirePermissions('pim.product.update') @Patch('products/:id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: UpdateProductDto) { return this.pim.update(user, id, input); }
  @RequirePermissions('pim.product.update') @Post('products/:id/skus') addSku(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: CreateProductSkuDto) { return this.pim.addSku(user, id, input); }
  @RequirePermissions('pim.asset.manage') @Post('products/:id/assets') addAsset(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() input: AddProductAssetDto) { return this.pim.addAsset(user, id, input); }
}
