import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import type { IJob } from 'src/crawler/interfaces/base-strategy.interface';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * 创建单个职位
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() jobData: IJob): Promise<Job> {
    return this.jobsService.create(jobData);
  }

  /**
   * 批量创建职位
   */
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createMany(@Body() jobsData: IJob[]): Promise<Job[]> {
    return this.jobsService.createMany(jobsData);
  }

  /**
   * 获取所有职位列表
   */
  @Get()
  async findAll(): Promise<Job[]> {
    return this.jobsService.findAll();
  }

  /**
   * 根据 ID 获取单个职位
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Job> {
    return this.jobsService.findOne(id);
  }
}
