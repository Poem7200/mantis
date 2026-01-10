import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlerService } from './crawler.service';
import { JobsService } from '../jobs/jobs.service';
import { ConfigService } from '@nestjs/config';
import type { ICrawlOptions } from './interfaces/base-strategy.interface';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_CRAWL_STRATEGY,
  DEFAULT_CRAWL_MAX_RESULTS_SCHEDULER,
  DEFAULT_CRAWL_KEYWORD,
} from '../config/constants';

@Injectable()
export class CrawlerSchedulerService {
  private readonly logger = new Logger(CrawlerSchedulerService.name);
  private isRunning = false; // 防止并发执行

  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly jobsService: JobsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 定时爬取任务 - 每 6 小时执行一次
   * 可以通过环境变量 CRAWL_CRON 自定义 cron 表达式
   */
  @Cron(process.env.CRAWL_CRON || CronExpression.EVERY_6_HOURS, {
    name: 'crawl-jobs',
    timeZone: process.env.TZ || DEFAULT_TIMEZONE,
  })
  async handleCron() {
    if (this.isRunning) {
      this.logger.warn('上一次爬虫任务仍在执行中，跳过本次任务');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('开始执行定时爬虫任务...');

      // 获取要爬取的策略列表（可以通过环境变量配置）
      const strategies = this.configService
        .get<string>('CRAWL_STRATEGIES', DEFAULT_CRAWL_STRATEGY)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // 获取爬取选项
      const options: ICrawlOptions = {
        headless: true, // 定时任务始终使用 headless 模式
        keyword: DEFAULT_CRAWL_KEYWORD,
        maxResults: parseInt(
          this.configService.get<string>(
            'CRAWL_MAX_RESULTS',
            String(DEFAULT_CRAWL_MAX_RESULTS_SCHEDULER),
          ),
          10,
        ),
      };

      // 批量爬取
      const results = await this.crawlerService.crawlMultiple(
        strategies,
        options,
      );

      // 保存所有结果到数据库
      let totalSaved = 0;
      let totalSkipped = 0;

      for (const [strategy, jobs] of results.entries()) {
        if (jobs.length > 0) {
          const { saved, skipped } =
            await this.jobsService.createManyWithDuplicateHandling(jobs);
          totalSaved += saved.length;
          totalSkipped += skipped;

          this.logger.log(
            `策略 ${strategy}: 保存 ${saved.length} 个，跳过 ${skipped} 个`,
          );
        } else {
          this.logger.warn(`策略 ${strategy}: 未找到职位信息`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(
        `定时爬虫任务完成: 总计保存 ${totalSaved} 个职位，跳过 ${totalSkipped} 个，耗时 ${duration} 秒`,
      );
    } catch (error) {
      this.logger.error(
        `定时爬虫任务失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 手动触发定时任务（用于测试）
   */
  async handleManually(): Promise<void> {
    await this.handleCron();
  }
}
