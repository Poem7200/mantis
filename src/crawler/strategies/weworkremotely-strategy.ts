import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import {
  ICrawlerStrategy,
  ICrawlOptions,
  IJob,
} from 'src/crawler/interfaces/base-strategy.interface';
import {
  DEFAULT_MAX_RESULTS,
  DEFAULT_PAGE_TIMEOUT,
} from 'src/config/constants';

@Injectable()
export class WeWorkRemotelyStrategy implements ICrawlerStrategy {
  readonly name = 'weworkremotely';
  readonly baseUrl = 'https://weworkremotely.com';

  private readonly logger = new Logger(WeWorkRemotelyStrategy.name);

  /**
   * 生成 WeWorkRemotely 的搜索 URL
   */
  generateUrl(keyword?: string): string {
    // WeWorkRemotely 主要按分类组织，默认使用编程类职位
    let url = `${this.baseUrl}/categories/remote-programming-jobs`;
    // TODO: 当前keyword只是指的岗位关键词，但其实有可能包含了地区等各种信息，需要扩展完善
    if (keyword) {
      // WeWorkRemotely 的搜索可能需要通过搜索功能实现，这里先使用分类页面
      url = `${this.baseUrl}/categories/remote-programming-jobs`;
    }
    return url;
  }

  /**
   * 爬取 WeWorkRemotely 网站的职位信息
   */
  async crawl(page: Page, options: ICrawlOptions = {}): Promise<IJob[]> {
    const { keyword, maxResults = DEFAULT_MAX_RESULTS } = options;

    try {
      this.logger.log(`开始爬取 WeWorkRemotely，关键词: ${keyword || '全部'}`);

      // 构建 URL
      const url = this.generateUrl(keyword);

      // 导航到页面
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_PAGE_TIMEOUT,
      });

      this.logger.debug(`页面加载完成: ${url}`);

      // 等待职位列表加载
      // WeWorkRemotely 的职位列表通常在 .jobs 或类似的选择器中
      await page.waitForSelector('section.jobs', {
        timeout: DEFAULT_PAGE_TIMEOUT,
      });

      // TODO: WeWorkRemotely 的岗位加载可能需要翻页，需要实现翻页逻辑

      // 提取职位数据
      const jobs = await this.extractJobs(page, maxResults);

      this.logger.log(`成功爬取 ${jobs.length} 个职位`);
      return jobs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `爬取 WeWorkRemotely 失败: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * 提取职位信息
   */
  async extractJobs(page: Page, maxResults: number): Promise<IJob[]> {
    try {
      // WeWorkRemotely 的职位数据提取
      // 注意：必须通过参数传递 baseUrl，因为 page.evaluate() 无法访问闭包变量
      const jobs = await page.evaluate(
        ({ max, baseUrl }: { max: number; baseUrl: string }) => {
          // WeWorkRemotely 的职位通常在 section.jobs > article 或 li.job 中
          const jobElements = Array.from(
            document
              .querySelector('section.jobs')
              ?.querySelectorAll('li.new-listing-container') || [],
          ).slice(0, max);

          return jobElements
            .map((element) => {
              try {
                const contentContainer = element.querySelector(
                  'a.listing-link--unlocked',
                );

                // 获取职位链接
                const jobUrl =
                  contentContainer?.getAttribute('href')?.trim() ||
                  'no apply link';
                const url = `${baseUrl}${jobUrl}`;

                // 获取职位标题
                const title =
                  contentContainer
                    ?.querySelector('h3.new-listing__header__title')
                    ?.textContent?.trim() || 'Untitled';
                // 获取发布时间
                const postedAt =
                  contentContainer
                    ?.querySelector('p.new-listing__header__icons__date')
                    ?.textContent?.trim() || 'Unknown Publish Time';
                // 获取公司名称
                const company =
                  contentContainer
                    ?.querySelector('.new-listing__company-name')
                    ?.textContent?.trim() || 'Unknown Company';
                // 获取公司地址
                // TODO: 这里location就是公司地址
                const location =
                  contentContainer
                    ?.querySelector('.new-listing__company-headquarters')
                    ?.textContent?.trim() || 'Unknown Location';
                // 获取标签
                const tagsContainer = contentContainer?.querySelector(
                  '.new-listing__categories',
                );
                const tags = Array.from(
                  tagsContainer?.querySelectorAll(
                    '.new-listing__categories__category',
                  ) || [],
                ).map((tag) => tag.textContent?.trim() || '');

                // 获取标签
                return {
                  title,
                  company,
                  url,
                  location,
                  tags,
                  // TODO: salary在tags中，但是很难判断哪一条是
                  salary: undefined,
                  postedAt,
                  source: 'weworkremotely',
                };
              } catch (error) {
                console.error('提取职位信息失败:', error);
                return null;
              }
            })
            .filter((job) => job !== null);
        },
        { max: maxResults, baseUrl: this.baseUrl },
      );

      return jobs as IJob[];
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('提取职位信息失败', errorStack);
      return [];
    }
  }
}
