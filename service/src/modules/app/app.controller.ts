import { AppService } from './app.service';
import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateCatsDto } from './dto/createCats.dto';
import { UpdateCatsDto } from './dto/updateCats.dto';
import { DeleteCatsDto } from './dto/deleteCats.dto';
import { QuerCatsDto } from './dto/queryCats.dto';
import { CreateAppDto } from './dto/createApp.dto';
import { UpdateAppDto } from './dto/updateApp.dto';
import { OperateAppDto } from './dto/deleteApp.dto';
import { QuerAppDto } from './dto/queryApp.dto';
import { SuperAuthGuard } from '@/common/auth/superAuth.guard';
import { AdminAuthGuard } from '@/common/auth/adminAuth.guard';
import { JwtAuthGuard } from '@/common/auth/jwtAuth.guard';
import { CollectAppDto } from './dto/collectApp.dto';
import { Request } from 'express';
import { CustomAppDto } from './dto/custonApp.dto';

@ApiTags('App')
@Controller('app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('queryAppCats')
  @ApiOperation({ summary: '获取App分类列表' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  appCatsList(@Query() query: QuerCatsDto) {
    return this.appService.appCatsList(query);
  }

  @Get('queryCats')
  @ApiOperation({ summary: '用户端获取App分类列表' })
  catsList() {
    const params: QuerCatsDto = { status: 1, page: 1, size: 1000, name: '' };
    return this.appService.appCatsList(params);
  }

  @Get('queryOneCat')
  @ApiOperation({ summary: '用户端获取App分类列表' })
  queryOneCats(@Query() query) {
    return this.appService.queryOneCat(query);
  }

  @Post('createAppCats')
  @ApiOperation({ summary: '添加App分类' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  createAppCat(@Body() body: CreateCatsDto) {
    return this.appService.createAppCat(body);
  }

  @Post('updateAppCats')
  @ApiOperation({ summary: '修改App分类' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  updateAppCats(@Body() body: UpdateCatsDto) {
    return this.appService.updateAppCats(body);
  }

  @Post('delAppCats')
  @ApiOperation({ summary: '删除App分类' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  delAppCat(@Body() body: DeleteCatsDto) {
    return this.appService.delAppCat(body);
  }

  @Get('queryApp')
  @ApiOperation({ summary: '获取App列表' })
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  appList(@Req() req: Request, @Query() query: QuerAppDto) {
    return this.appService.appList(req, query);
  }

  @Get('list')
  @ApiOperation({ summary: '客户端获取App' })
  list(@Req() req: Request, @Query() query: QuerAppDto) {
    return this.appService.frontAppList(req, query);
  }

  @Post('createApp')
  @ApiOperation({ summary: '添加App' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  createApp(@Body() body: CreateAppDto) {
    return this.appService.createApp(body);
  }

  @Post('customApp')
  @ApiOperation({ summary: '添加自定义App' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  customApp(@Body() body: CustomAppDto, @Req() req: Request) {
    return this.appService.customApp(body, req);
  }

  @Post('updateApp')
  @ApiOperation({ summary: '修改App' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  updateApp(@Body() body: UpdateAppDto) {
    return this.appService.updateApp(body);
  }

  @Post('delApp')
  @ApiOperation({ summary: '删除App' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  delApp(@Body() body: OperateAppDto) {
    return this.appService.delApp(body);
  }

  @Post('auditPass')
  @ApiOperation({ summary: '审核通过App' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  auditPass(@Body() body: OperateAppDto) {
    return this.appService.auditPass(body);
  }

  @Post('auditFail')
  @ApiOperation({ summary: '审核拒绝App' })
  @UseGuards(SuperAuthGuard)
  @ApiBearerAuth()
  auditFail(@Body() body: OperateAppDto) {
    return this.appService.auditFail(body);
  }

  @Post('delMineApp')
  @ApiOperation({ summary: '删除个人App' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  delMineApp(@Body() body: OperateAppDto, @Req() req: Request) {
    return this.appService.delMineApp(body, req);
  }

  @Post('collect')
  @ApiOperation({ summary: '收藏/取消收藏App' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  collect(@Body() body: CollectAppDto, @Req() req: Request) {
    return this.appService.collect(body, req);
  }

  @Get('mineApps')
  @ApiOperation({ summary: '我的收藏' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  mineApps(@Req() req: Request) {
    return this.appService.mineApps(req);
  }
}
