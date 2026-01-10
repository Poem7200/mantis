import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import {
  ICrawlerStrategy,
  ICrawlOptions,
  IJob,
} from '../interfaces/base-strategy.interface';
import {
  DEFAULT_MAX_RESULTS,
  DEFAULT_PAGE_TIMEOUT,
  DEFAULT_SELECTOR_TIMEOUT,
  DEFAULT_SCROLL_WAIT_TIMEOUT,
} from '../../config/constants';

@Injectable()
export class RemoteOkStrategy implements ICrawlerStrategy {
  readonly name = 'remoteok';
  readonly baseUrl = 'https://remoteok.com';

  private readonly logger = new Logger(RemoteOkStrategy.name);

  /**
   * 生成 RemoteOK 的搜索 URL
   */
  generateUrl(keyword?: string): string {
    let url = `${this.baseUrl}/remote-dev-jobs`;
    if (keyword) {
      // TODO: keyword可能有多个，需要尝试并了解一下remoteok处理多个keyword是怎么操作的
      url = `${this.baseUrl}/remote-${keyword.toLowerCase()}-jobs`;
    }
    return url;
  }

  /**
   * 爬取 RemoteOK 网站的职位信息
   */
  async crawl(page: Page, options: ICrawlOptions = {}): Promise<IJob[]> {
    const { keyword, maxResults = DEFAULT_MAX_RESULTS } = options;

    try {
      this.logger.log(`开始爬取 RemoteOK，关键词: ${keyword || '全部'}`);

      // 构建 URL
      const url = this.generateUrl(keyword);
      // 导航到页面
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: DEFAULT_PAGE_TIMEOUT,
      });

      this.logger.debug(`页面加载完成: ${url}`);

      // 等待职位列表加载
      await page.waitForSelector('table#jobsboard', {
        timeout: DEFAULT_SELECTOR_TIMEOUT,
      });

      // 滚动页面以触发懒加载
      await this.scrollToLoadMore(page);

      // 提取职位数据
      const jobs = await this.extractJobs(page, maxResults);

      this.logger.log(`成功爬取 ${jobs.length} 个职位`);
      return jobs;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`爬取 RemoteOK 失败: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * 滚动页面以加载更多内容
   */
  private async scrollToLoadMore(page: Page): Promise<void> {
    try {
      // RemoteOK 使用懒加载，需要滚动到底部
      const previousHeight = await page.evaluate(
        () => document.body.scrollHeight,
      );

      // 滚动到底部
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // 等待新内容加载
      await page.waitForTimeout(DEFAULT_SCROLL_WAIT_TIMEOUT);

      const newHeight = await page.evaluate(() => document.body.scrollHeight);

      // !这里有隐藏的坑，如果内容无限，那会一直滚动，其实应该限制一下滚动次数以及查找的岗位数量，而非无限制地翻
      // 如果高度变化，继续滚动
      if (newHeight > previousHeight) {
        await this.scrollToLoadMore(page);
      }
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.warn('滚动加载更多内容时出错', errorStack);
    }
  }

  /**
   * 提取职位信息
   */
  async extractJobs(page: Page, maxResults: number): Promise<IJob[]> {
    try {
      // RemoteOK 的职位数据在 table#jobsboard 中
      // 注意：必须通过参数传递 baseUrl，因为 page.evaluate() 无法访问闭包变量
      const jobs = await page.evaluate(
        ({ max, baseUrl }: { max: number; baseUrl: string }) => {
          const jobRows = Array.from(
            document.querySelectorAll('table#jobsboard tr.job'),
          ).slice(0, max);

          return jobRows
            .map((row) => {
              try {
                const mainInfoElement = row.querySelector(
                  'td.company_and_position',
                );
                // 提取职位标题
                const title =
                  mainInfoElement
                    ?.querySelector('h2[itemprop="title"]')
                    ?.textContent?.trim() || 'Untitled';
                // 提取公司名称
                const company =
                  mainInfoElement
                    ?.querySelector('h3[itemprop="name"]')
                    ?.textContent?.trim() || 'Unknown Company';
                // 提取地点
                const location =
                  mainInfoElement
                    ?.querySelector('.location[title]')
                    ?.textContent?.trim() || 'Remote';
                // 提取url
                const url =
                  row?.getAttribute('data-url') ||
                  row?.getAttribute('href') ||
                  'no apply link';

                // 提取标签
                const tagElements = row.querySelectorAll('td.tags a');
                const tags = Array.from(tagElements)
                  .map((tag) => tag.textContent?.trim() || '')
                  .filter(Boolean);

                // 提取发布时间
                const timeElement = row.querySelector('td.time');
                const postedAt =
                  timeElement?.getAttribute('title') ||
                  timeElement?.textContent?.trim() ||
                  '';

                return {
                  title,
                  company,
                  url: `${baseUrl}${url}`, // 使用传入的 baseUrl 参数
                  location,
                  tags,
                  postedAt,
                  source: 'remoteok',
                };
              } catch (error) {
                console.error('提取职位信息失败:', error);
                return null;
              }
            })
            .filter(Boolean);
        },
        { max: maxResults, baseUrl: this.baseUrl }, // 将参数打包成对象传递
      );

      return jobs as IJob[];
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('提取职位信息失败', errorStack);
      return [];
    }
  }
}
