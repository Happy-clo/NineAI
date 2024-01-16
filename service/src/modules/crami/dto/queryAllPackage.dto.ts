import { IsNotEmpty, MinLength, MaxLength, IsString, IsIn, IsOptional, Max, Min, ValidateNested, IsNumber, IsDefined } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BaseEntity } from 'typeorm';

export class QuerAllPackageDto {
  @ApiProperty({ example: 1, description: '查询页数', required: false })
  @IsOptional()
  page: number;

  @ApiProperty({ example: 10, description: '每页数量', required: false })
  @IsOptional()
  size: number;

  @ApiProperty({ example: 'name', description: '套餐名称', required: false })
  @IsOptional()
  name: string;

  @ApiProperty({ example: 1, description: '套餐状态 0：禁用 1：启用', required: false })
  @IsOptional()
  status: number;

  @ApiProperty({ example: 1, description: '套餐类型 -1：永久套餐 1：限时套餐', required: false })
  @IsOptional()
  type: number;
}
