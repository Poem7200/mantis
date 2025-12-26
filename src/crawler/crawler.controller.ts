import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { JobsService } from 'src/jobs/jobs.service';
import type { ICrawlOptions } from './interfaces/base-strategy.interface';
import { DEFAULT_MAX_RESULTS } from 'src/config/constants';

@Controller('crawler')
export class CrawlerController {
  private readonly logger = new Logger(CrawlerController.name);

  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * 手动触发爬虫任务
   * POST /crawler/crawl
   */
  @Post('crawl')
  @HttpCode(HttpStatus.ACCEPTED)
  crawl(
    @Body()
    body: {
      strategy?: string;
      keyword?: string;
      maxResults?: number;
    },
  ) {
    const strategy = body.strategy || 'remoteok';
    const options: ICrawlOptions = {
      headless: process.env.NODE_ENV === 'production', // 生产环境自动 headless
      keyword: body.keyword,
      maxResults: body.maxResults || DEFAULT_MAX_RESULTS,
    };

    this.logger.log(`手动触发爬虫任务: ${strategy}`);

    // 异步执行，立即返回
    this.executeCrawl(strategy, options).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`爬虫任务失败: ${errorMessage}`, errorStack);
    });

    return {
      message: '爬虫任务已启动',
      strategy,
      status: 'processing',
    };
  }

  /**
   * 执行爬虫并保存到数据库
   */
  private async executeCrawl(
    strategy: string,
    options: ICrawlOptions,
  ): Promise<void> {
    try {
      const jobs = await this.crawlerService.crawl(strategy, options);

      if (jobs.length > 0) {
        const { saved, skipped } =
          await this.jobsService.createManyWithDuplicateHandling(jobs);

        this.logger.log(
          `爬虫任务完成: 保存 ${saved.length} 个职位，跳过 ${skipped} 个重复职位`,
        );
      } else {
        this.logger.warn('爬虫任务完成: 未找到职位信息');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`爬虫任务执行失败: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * 获取可用的爬虫策略列表
   * GET /crawler/strategies
   */
  @Get('strategies')
  getStrategies() {
    return {
      strategies: this.crawlerService.getAvailableStrategies(),
    };
  }
}
