import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '../browser/browser.service';
import {
  ICrawlerStrategy,
  ICrawlOptions,
  IJob,
} from './interfaces/base-strategy.interface';
import { RemoteOkStrategy } from './strategies/remoteok-strategy';
import { HimalayasStrategy } from './strategies/himalayas-strategy';
import { WeWorkRemotelyStrategy } from './strategies/weworkremotely-strategy';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly strategies: Map<string, ICrawlerStrategy> = new Map();

  constructor(
    private readonly browserService: BrowserService,
    private readonly remoteOkStrategy: RemoteOkStrategy,
    private readonly himalayasStrategy: HimalayasStrategy,
    private readonly weWorkRemotelyStrategy: WeWorkRemotelyStrategy,
  ) {
    // 注册所有策略
    this.registerStrategy(remoteOkStrategy);
    this.registerStrategy(himalayasStrategy);
    this.registerStrategy(weWorkRemotelyStrategy);
  }

  /**
   * 注册爬虫策略
   */
  private registerStrategy(strategy: ICrawlerStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.log(`注册爬虫策略: ${strategy.name}`);
  }

  /**
   * 获取策略
   */
  getStrategy(name: string): ICrawlerStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * 获取所有可用的策略名称
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 使用指定策略爬取职位
   * @param strategyName 策略名称
   * @param options 爬取选项
   */
  async crawl(
    strategyName: string,
    options: ICrawlOptions = {},
  ): Promise<IJob[]> {
    const strategy = this.getStrategy(strategyName);

    if (!strategy) {
      throw new Error(
        `策略 "${strategyName}" 不存在。可用策略: ${this.getAvailableStrategies().join(', ')}`,
      );
    }

    this.logger.log(`使用策略 "${strategyName}" 开始爬取`);

    // 从选项中提取 headless 设置，默认为 false（非 headless 模式，可以看到浏览器）
    const headless = (options.headless as boolean | undefined) ?? false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { headless: _headless, ...crawlOptions } = options;

    // 确保浏览器已启动
    const browser = this.browserService.getBrowser();
    if (!browser) {
      await this.browserService.launch({ headless });
    }

    // 创建新页面
    const page = await this.browserService.newPage();

    try {
      // 执行爬取（只传递爬取相关的选项，不包含 headless）
      const jobs = await strategy.crawl(page, crawlOptions);

      this.logger.log(
        `策略 "${strategyName}" 爬取完成，获取 ${jobs.length} 个职位`,
      );

      return jobs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `策略 "${strategyName}" 爬取失败: ${errorMessage}`,
        errorStack,
      );
      throw error;
    } finally {
      // 关闭页面
      await this.browserService.closePage(page);
    }
  }

  /**
   * 批量爬取多个网站
   * @param strategyNames 策略名称数组
   * @param options 爬取选项
   */
  async crawlMultiple(
    strategyNames: string[],
    options: ICrawlOptions = {},
  ): Promise<Map<string, IJob[]>> {
    const results = new Map<string, IJob[]>();

    for (const strategyName of strategyNames) {
      try {
        const jobs = await this.crawl(strategyName, options);
        results.set(strategyName, jobs);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        this.logger.error(
          `批量爬取时策略 "${strategyName}" 失败: ${errorMessage}`,
        );
        results.set(strategyName, []);
      }
    }

    return results;
  }

  /**
   * 爬取所有可用策略
   */
  async crawlAll(options: ICrawlOptions = {}): Promise<Map<string, IJob[]>> {
    return this.crawlMultiple(this.getAvailableStrategies(), options);
  }
}
