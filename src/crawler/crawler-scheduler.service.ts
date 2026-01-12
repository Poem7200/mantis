import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlerService } from './crawler.service';
import { JobsService } from 'src/jobs/jobs.service';
import { ConfigService } from '@nestjs/config';
import type { ICrawlOptions, IJob } from './interfaces/base-strategy.interface';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_CRAWL_STRATEGY,
  DEFAULT_CRAWL_MAX_RESULTS_SCHEDULER,
  DEFAULT_CRAWL_KEYWORD,
} from 'src/config/constants';

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

      // 统计信息
      let totalSaved = 0;
      let totalSkipped = 0;
      const strategyStats = new Map<
        string,
        { saved: number; skipped: number }
      >();

      // 为每个策略创建存储回调
      const createStorageCallback = (strategyName: string) => {
        return async (jobs: IJob[]): Promise<void> => {
          if (jobs.length === 0) {
            return;
          }

          const { saved, skipped } =
            await this.jobsService.createManyWithDuplicateHandling(jobs);
          totalSaved += saved.length;
          totalSkipped += skipped;

          // 更新策略统计
          const currentStats = strategyStats.get(strategyName) || {
            saved: 0,
            skipped: 0,
          };
          strategyStats.set(strategyName, {
            saved: currentStats.saved + saved.length,
            skipped: currentStats.skipped + skipped,
          });

          this.logger.log(
            `策略 ${strategyName}: 本页保存 ${saved.length} 个，跳过 ${skipped} 个`,
          );
        };
      };

      // 批量爬取，为每个策略传入存储回调
      for (const strategyName of strategies) {
        try {
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
            onPageCrawled: createStorageCallback(strategyName),
          };

          await this.crawlerService.crawl(strategyName, options);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '未知错误';
          this.logger.error(`策略 ${strategyName} 爬取失败: ${errorMessage}`);
        }
      }

      // 输出每个策略的统计信息
      for (const [strategy, stats] of strategyStats.entries()) {
        this.logger.log(
          `策略 ${strategy}: 总计保存 ${stats.saved} 个，跳过 ${stats.skipped} 个`,
        );
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
