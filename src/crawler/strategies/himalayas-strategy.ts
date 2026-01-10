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
export class HimalayasStrategy implements ICrawlerStrategy {
  readonly name = 'himalayas';
  readonly baseUrl = 'https://himalayas.app';

  private readonly logger = new Logger(HimalayasStrategy.name);

  /**
   * 生成 Himalayas 的搜索 URL
   */
  generateUrl(keyword?: string): string {
    let url = `${this.baseUrl}/jobs`;
    // TODO: 当前keyword只是指的岗位关键词，但其实有可能包含了地区等各种信息，需要扩展完善
    if (keyword) {
      url = `${this.baseUrl}/jobs/${keyword}`;
    }
    return url;
  }

  /**
   * 爬取 Himalayas 网站的职位信息
   */
  async crawl(page: Page, options: ICrawlOptions = {}): Promise<IJob[]> {
    const { keyword, maxResults = DEFAULT_MAX_RESULTS } = options;

    try {
      this.logger.log(`开始爬取 Himalayas，关键词: ${keyword || '全部'}`);

      // 构建 URL
      const url = this.generateUrl(keyword);

      // 导航到页面
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_PAGE_TIMEOUT,
      });

      this.logger.debug(`页面加载完成: ${url}`);

      // 等待职位列表加载
      // himalayas用的tailwindcss，相对来说“爬虫不友好”，目前定位的是这个内容区域，需要测试看一下实际的情况
      await page.waitForSelector(
        'xpath=//div[contains(@class, "group-has-[[data-pending]]/pending:hidden")]',
        {
          timeout: DEFAULT_PAGE_TIMEOUT,
        },
      );

      // TODO: himalayas的岗位加载不是无限加载那一套，而是翻页，所以需要有一个人工的点击过程（先尝试快速自动化，如果有反爬虫，改进为“模拟人类点击”的反爬虫模式）

      // 提取职位数据
      const jobs = await this.extractJobs(page, maxResults);

      this.logger.log(`成功爬取 ${jobs.length} 个职位`);
      return jobs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`爬取 Himalayas 失败: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * 提取职位信息
   */
  async extractJobs(page: Page, maxResults: number): Promise<IJob[]> {
    try {
      // Himalayas 的职位数据提取
      // 注意：必须通过参数传递 baseUrl，因为 page.evaluate() 无法访问闭包变量
      const jobs = await page.evaluate(
        ({ max, baseUrl }: { max: number; baseUrl: string }) => {
          const container = document.querySelector(
            'div.group-has-\\[\\[data-pending\\]\\]\\/pending\\:hidden',
          );

          const jobElements = Array.from(
            container?.querySelectorAll('article') || [],
          ).slice(0, max);

          return jobElements
            .map((element) => {
              try {
                const contentElement = element?.children?.[1];

                const titleAndTimeElement = contentElement
                  ?.children?.[0] as HTMLElement;

                const titleElement = titleAndTimeElement?.querySelector('a');
                // 获取标题
                const title = titleElement?.textContent?.trim() || 'Untitled';
                // 获取链接
                const jobUrl =
                  titleElement?.getAttribute('href') || 'no apply link';
                const url = `${baseUrl}${jobUrl}`;

                // 获取发布时间
                const postedAt =
                  titleAndTimeElement
                    ?.querySelector('time')
                    ?.textContent?.trim() || 'Unknown Time';

                // 获取公司名称
                const companyInfoElement = contentElement
                  ?.children?.[1] as HTMLElement;
                const company =
                  companyInfoElement?.children?.[0]
                    ?.querySelector('a')
                    ?.textContent?.trim() || 'Unknown Company';

                const locationAndTypeInfoElement = contentElement
                  ?.children?.[2] as HTMLElement;
                // 获取岗位地点
                const location =
                  locationAndTypeInfoElement?.children?.[0]?.textContent?.trim() ||
                  'Unknown Location';
                // 获取岗位类型
                const type =
                  locationAndTypeInfoElement?.children?.[1]?.textContent?.trim() ||
                  'Unknown Type';
                // 获取岗位分类
                const category =
                  locationAndTypeInfoElement?.children?.[2]
                    ?.querySelector('a')
                    ?.textContent?.trim() || 'Unknown Category';

                const tags = [type, category];

                return {
                  title,
                  company,
                  url,
                  location,
                  tags,
                  salary: 'test salary',
                  postedAt,
                  source: 'himalayas',
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
