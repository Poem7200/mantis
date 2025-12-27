import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import {
  ICrawlerStrategy,
  ICrawlOptions,
  IJob,
} from '../interfaces/base-strategy.interface';

@Injectable()
export class HimalayasStrategy implements ICrawlerStrategy {
  readonly name = 'himalayas';
  readonly baseUrl = 'https://himalayas.app';

  private readonly logger = new Logger(HimalayasStrategy.name);
  private readonly maxScrollAttempts = 10; // 最大滚动次数，避免无限滚动

  /**
   * 爬取 Himalayas 网站的职位信息
   */
  async crawl(page: Page, options: ICrawlOptions = {}): Promise<IJob[]> {
    const { keyword, maxResults = 50 } = options;

    try {
      this.logger.log(`开始爬取 Himalayas，关键词: ${keyword || '全部'}`);

      // 构建 URL
      // TODO: 当前keyword只是指的岗位关键词，但其实有可能包含了地区等各种信息，需要扩展完善
      let url = `${this.baseUrl}/jobs`;
      if (keyword) {
        url = `${this.baseUrl}/jobs/${keyword}`;
      }

      // 导航到页面
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      this.logger.debug(`页面加载完成: ${url}`);

      // 等待职位列表加载
      // himalayas用的tailwindcss，相对来说“爬虫不友好”，目前定位的是这个内容区域，需要测试看一下实际的情况
      await page.waitForSelector(
        'xpath=//div[contains(@class, "group-has-[[data-pending]]/pending:hidden")]',
        {
          timeout: 30000,
        },
      );

      // himalayas的岗位加载不是无限加载那一套，而是翻页，所以需要有一个人工的点击过程（先尝试快速自动化，如果有反爬虫，改进为“模拟人类点击”的反爬虫模式）

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
  private async extractJobs(page: Page, maxResults: number): Promise<IJob[]> {
    this.logger.log('尝试提取职位信息');
    try {
      // Himalayas 的职位数据提取
      // 注意：必须通过参数传递 baseUrl，因为 page.evaluate() 无法访问闭包变量
      const jobs = await page.evaluate(
        ({ max, baseUrl }: { max: number; baseUrl: string }) => {
          // 尝试多种选择器来查找职位元素
          const jobSelectors = [
            '[data-testid="job-item"]',
            '.job-item',
            '[class*="job-card"]',
            '[class*="job-listing"]',
            'article[class*="job"]',
            '[role="article"]',
          ];

          let jobElements: Element[] = [];
          for (const selector of jobSelectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            if (elements.length > 0) {
              jobElements = elements;
              break;
            }
          }

          // 如果没找到，尝试查找所有可能的职位容器
          if (jobElements.length === 0) {
            // 查找包含职位相关文本的元素
            const allElements = Array.from(document.querySelectorAll('*'));
            jobElements = allElements.filter((el) => {
              const text = el.textContent?.toLowerCase() || '';
              const hasJobKeywords =
                text.includes('apply') ||
                text.includes('remote') ||
                text.includes('salary') ||
                text.includes('$');
              return (
                hasJobKeywords &&
                el.querySelector('a') &&
                el.children.length > 0
              );
            });
          }

          return jobElements
            .slice(0, max)
            .map((element) => {
              try {
                // 提取职位标题 - 尝试多种选择器
                const titleSelectors = [
                  'h2',
                  'h3',
                  '[class*="title"]',
                  '[class*="name"]',
                  'a',
                ];
                let title = 'Untitled';
                for (const selector of titleSelectors) {
                  const titleEl = element.querySelector(selector);
                  if (titleEl?.textContent?.trim()) {
                    title = titleEl.textContent.trim();
                    break;
                  }
                }

                // 提取公司名称
                const companySelectors = [
                  '[class*="company"]',
                  '[class*="employer"]',
                  'strong',
                  'span[class*="company"]',
                ];
                let company = 'Unknown Company';
                for (const selector of companySelectors) {
                  const companyEl = element.querySelector(selector);
                  if (companyEl?.textContent?.trim()) {
                    company = companyEl.textContent.trim();
                    break;
                  }
                }

                // 提取职位链接
                const linkEl = element.querySelector('a');
                let url = linkEl?.getAttribute('href') || '';
                if (url && !url.startsWith('http')) {
                  url = url.startsWith('/')
                    ? `${baseUrl}${url}`
                    : `${baseUrl}/${url}`;
                } else if (!url) {
                  url = 'no apply link';
                }

                // 提取地点
                const locationSelectors = [
                  '[class*="location"]',
                  '[class*="place"]',
                  '[class*="remote"]',
                ];
                let location = 'Remote';
                for (const selector of locationSelectors) {
                  const locationEl = element.querySelector(selector);
                  if (locationEl?.textContent?.trim()) {
                    location = locationEl.textContent.trim();
                    break;
                  }
                }

                // 提取标签
                const tagSelectors = [
                  '[class*="tag"]',
                  '[class*="skill"]',
                  '[class*="tech"]',
                  'span[class*="badge"]',
                ];
                const tags: string[] = [];
                for (const selector of tagSelectors) {
                  const tagElements = element.querySelectorAll(selector);
                  if (tagElements.length > 0) {
                    Array.from(tagElements).forEach((tag) => {
                      const tagText = tag.textContent?.trim();
                      if (tagText) {
                        tags.push(tagText);
                      }
                    });
                    break;
                  }
                }

                // 提取薪资
                const salarySelectors = [
                  '[class*="salary"]',
                  '[class*="pay"]',
                  '[class*="compensation"]',
                ];
                let salary: string | undefined;
                for (const selector of salarySelectors) {
                  const salaryEl = element.querySelector(selector);
                  if (salaryEl?.textContent?.trim()) {
                    salary = salaryEl.textContent.trim();
                    break;
                  }
                }

                // 提取发布时间
                const timeSelectors = [
                  '[class*="time"]',
                  '[class*="date"]',
                  '[class*="posted"]',
                  'time',
                ];
                let postedAt: string | undefined;
                for (const selector of timeSelectors) {
                  const timeEl = element.querySelector(selector);
                  if (timeEl) {
                    postedAt =
                      timeEl.getAttribute('datetime') ||
                      timeEl.getAttribute('title') ||
                      timeEl.textContent?.trim() ||
                      undefined;
                    if (postedAt) break;
                  }
                }

                return {
                  title,
                  company,
                  url,
                  location: location || undefined,
                  tags: tags.length > 0 ? tags : undefined,
                  salary,
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
