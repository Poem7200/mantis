import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import type { IJob } from '../crawler/interfaces/base-strategy.interface';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
  ) {}

  async create(jobData: IJob): Promise<Job> {
    const job = this.jobRepository.create({
      title: jobData.title,
      company: jobData.company,
      url: jobData.url,
      description: jobData.description,
      location: jobData.location,
      salary: jobData.salary,
      tags: jobData.tags,
      source: jobData.source,
      postedAt: jobData.postedAt ? new Date(jobData.postedAt) : undefined,
    });
    return this.jobRepository.save(job);
  }

  async createMany(jobsData: IJob[]): Promise<Job[]> {
    const jobs = jobsData.map((jobData) =>
      this.jobRepository.create({
        title: jobData.title,
        company: jobData.company,
        url: jobData.url,
        description: jobData.description,
        location: jobData.location,
        salary: jobData.salary,
        tags: jobData.tags,
        source: jobData.source,
        postedAt: jobData.postedAt ? new Date(jobData.postedAt) : undefined,
      }),
    );
    return this.jobRepository.save(jobs);
  }

  async findAll(): Promise<Job[]> {
    return this.jobRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }
    return job;
  }

  /**
   * 批量创建职位，自动处理重复数据（基于 url + source 的唯一索引）
   * @param jobsData 职位数据数组
   * @returns 保存结果，包含成功保存的职位和跳过的数量
   */
  async createManyWithDuplicateHandling(
    jobsData: IJob[],
  ): Promise<{ saved: Job[]; skipped: number }> {
    const saved: Job[] = [];
    let skipped = 0;

    for (const jobData of jobsData) {
      try {
        // 先检查是否已存在相同的 url + source
        const existingJob = await this.jobRepository.findOne({
          where: {
            url: jobData.url,
            source: jobData.source,
          },
        });

        if (existingJob) {
          skipped++;
          continue;
        }

        // 不存在则创建
        const job = await this.create(jobData);
        saved.push(job);
      } catch (error) {
        // 检查是否是唯一约束错误（双重保险）
        if (
          error instanceof Error &&
          (error.message.includes('duplicate key') ||
            error.message.includes('UNIQUE constraint') ||
            error.message.includes('unique constraint'))
        ) {
          skipped++;
        } else {
          // 其他错误继续抛出
          throw error;
        }
      }
    }

    return { saved, skipped };
  }
}
