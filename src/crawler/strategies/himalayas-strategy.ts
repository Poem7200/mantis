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
    const {
      keyword,
      maxResults = DEFAULT_MAX_RESULTS,
      onPageCrawled,
    } = options;

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

      // 记录已爬取的总数（用于判断是否达到 maxResults）
      let totalCrawled = 0;
      let currentPage = 1;

      // 循环翻页直到达到 maxResults 或没有下一页
      while (totalCrawled < maxResults) {
        this.logger.log(
          `开始提取第 ${currentPage} 页职位，当前已爬取 ${totalCrawled} 个职位，目标 ${maxResults} 个`,
        );

        // 提取当前页的所有职位
        const pageJobs = await this.extractJobsFromCurrentPage(page);

        if (pageJobs.length === 0) {
          this.logger.warn(`第 ${currentPage} 页未找到职位，停止爬取`);
          break;
        }

        // 如果提供了回调函数，立即存储当前页的数据
        if (onPageCrawled) {
          try {
            await (onPageCrawled as (jobs: IJob[]) => Promise<void>)(pageJobs);
            this.logger.log(
              `第 ${currentPage} 页提取完成，本页 ${pageJobs.length} 个职位已存储`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : '未知错误';
            this.logger.error(
              `第 ${currentPage} 页数据存储失败: ${errorMessage}`,
            );
            // 存储失败时继续执行，不中断爬取
          }
        } else {
          this.logger.log(
            `第 ${currentPage} 页提取完成，本页 ${pageJobs.length} 个职位`,
          );
        }

        // 更新已爬取总数
        totalCrawled += pageJobs.length;

        // 如果已经达到或超过目标数量，停止翻页
        if (totalCrawled >= maxResults) {
          this.logger.log(
            `已达到目标数量 ${maxResults}，停止翻页。实际爬取 ${totalCrawled} 个职位`,
          );
          break;
        }

        // 尝试翻页
        this.logger.log(`尝试翻到第 ${currentPage + 1} 页...`);
        const hasNextPage = await this.pageToLoadMore(page);

        if (!hasNextPage) {
          this.logger.log('已经是最后一页，停止翻页');
          break;
        }

        // 等待一下确保页面完全加载
        await page.waitForTimeout(1000);

        currentPage++;
      }

      this.logger.log(`Himalayas 爬取完成：共爬取 ${totalCrawled} 个职位`);
      // 由于数据已经通过回调存储，返回空数组
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`爬取 Himalayas 失败: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * 提取当前页的所有职位信息（不限制数量）
   */
  async extractJobsFromCurrentPage(page: Page): Promise<IJob[]> {
    try {
      const jobs = await page.evaluate(
        ({ baseUrl }: { baseUrl: string }) => {
          const container = document.querySelector(
            'div.group-has-\\[\\[data-pending\\]\\]\\/pending\\:hidden',
          );

          if (!container) {
            return [];
          }

          const jobElements = Array.from(container.querySelectorAll('article'));

          return jobElements
            .map((element) => {
              try {
                const contentElement = element?.children?.[1];

                const titleAndTimeElement = contentElement
                  ?.children?.[0] as HTMLElement;

                const titleElement = titleAndTimeElement?.querySelector('a');
                const title = titleElement?.textContent?.trim() || 'Untitled';
                const jobUrl =
                  titleElement?.getAttribute('href') || 'no apply link';
                const url = `${baseUrl}${jobUrl}`;

                const postedAt =
                  titleAndTimeElement
                    ?.querySelector('time')
                    ?.textContent?.trim() || 'Unknown Time';

                const companyInfoElement = contentElement
                  ?.children?.[1] as HTMLElement;
                const company =
                  companyInfoElement?.children?.[0]
                    ?.querySelector('a')
                    ?.textContent?.trim() || 'Unknown Company';

                const locationAndTypeInfoElement = contentElement
                  ?.children?.[2] as HTMLElement;
                const location =
                  locationAndTypeInfoElement?.children?.[0]?.textContent?.trim() ||
                  'Unknown Location';
                const type =
                  locationAndTypeInfoElement?.children?.[1]?.textContent?.trim() ||
                  'Unknown Type';
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
        { baseUrl: this.baseUrl },
      );

      return jobs as IJob[];
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('提取当前页职位信息失败', errorStack);
      return [];
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

  /**
   * 翻页到下一页
   * 通过在 URL 查询字符串中添加或修改 page 参数实现翻页
   * @param page Playwright 页面对象
   * @returns 如果成功翻页返回 true，如果已经是最后一页返回 false
   */
  async pageToLoadMore(page: Page): Promise<boolean> {
    try {
      // 获取当前页面 URL
      const currentUrl = page.url();

      // 解析 URL
      const url = new URL(currentUrl);
      const searchParams = url.searchParams;

      // 检查是否有 page 参数
      const currentPageParam = searchParams.get('page');
      let nextPage: number;

      if (currentPageParam === null) {
        // 如果没有 page 参数，添加 page=2
        nextPage = 2;
        this.logger.log('当前 URL 没有页码参数，将翻到第2页');
      } else {
        // 如果有 page 参数，将数字 +1
        const currentPage = parseInt(currentPageParam, 10);
        if (isNaN(currentPage)) {
          this.logger.warn(
            `当前页码参数值 "${currentPageParam}" 不是有效数字，重置为第2页`,
          );
          nextPage = 2;
        } else {
          nextPage = currentPage + 1;
          this.logger.log(`当前页码为${currentPage}，将翻到第${nextPage}页`);
        }
      }

      // 设置新的 page 参数
      searchParams.set('page', String(nextPage));

      // 构建新的 URL
      const newUrl = url.toString();
      this.logger.log(`准备翻页到第${nextPage}页`);

      // 导航到新 URL
      await page.goto(newUrl, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_PAGE_TIMEOUT,
      });

      // 等待页面完全加载
      await page
        .waitForLoadState('networkidle', {
          timeout: DEFAULT_PAGE_TIMEOUT,
        })
        .catch(() => {
          // 忽略超时错误，继续执行
        });

      // 等待职位列表加载
      await page.waitForSelector(
        'xpath=//div[contains(@class, "group-has-[[data-pending]]/pending:hidden")]',
        {
          timeout: DEFAULT_PAGE_TIMEOUT,
        },
      );

      this.logger.log(`翻页成功，已加载第 ${nextPage} 页`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`翻页失败: ${errorMessage}`, errorStack);
      return false;
    }
  }
}
