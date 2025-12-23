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

  /**
   * 解析相对时间字符串（如 "1d", "1mo"）为 Date 对象
   * @param relativeTime 相对时间字符串，如 "1d", "2d", "1mo", "1w", "1h" 等
   * @returns Date 对象，如果无法解析则返回 undefined
   */
  private parseRelativeTime(
    relativeTime: string | undefined,
  ): Date | undefined {
    if (!relativeTime || !relativeTime.trim()) {
      return undefined;
    }

    const trimmed = relativeTime.trim().toLowerCase();

    // 处理刚刚发布的情况
    if (trimmed === 'just now' || trimmed === 'now') {
      return new Date();
    }

    // 匹配数字和单位（如 "1d", "2d", "1mo", "1w"）
    const match = trimmed.match(/^(\d+)([a-z]+)$/);
    if (!match) {
      return undefined;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const now = new Date();
    let result: Date;

    switch (unit) {
      case 'h': // 小时
        result = new Date(now.getTime() - value * 60 * 60 * 1000);
        break;
      case 'd': // 天
        result = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
        break;
      case 'w': // 周
        result = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'mo': // 月（按30天计算）
        result = new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
        break;
      case 'y': // 年（按365天计算）
        result = new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return undefined;
    }

    return result;
  }

  async create(jobData: IJob): Promise<Job> {
    const {
      title,
      company,
      url,
      description,
      location,
      salary,
      tags,
      source,
      postedAt,
    } = jobData;
    const job = this.jobRepository.create({
      title,
      company,
      url,
      description,
      location,
      salary,
      tags,
      source,
      postedAt: this.parseRelativeTime(postedAt),
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
        postedAt: this.parseRelativeTime(jobData.postedAt),
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
