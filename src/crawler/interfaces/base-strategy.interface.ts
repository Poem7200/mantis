import { Page } from 'playwright';

/**
 * 职位数据模型
 */
export interface IJob {
  /** 职位标题 */
  title: string;
  /** 公司名称 */
  company: string;
  /** 职位链接 */
  url: string;
  /** 职位描述/摘要 */
  description?: string;
  /** 位置（远程/城市） */
  location?: string;
  /** 薪资范围 */
  salary?: string;
  /** 标签（技术栈等） */
  tags?: string[];
  /** 发布时间 */
  postedAt?: string;
  /** 来源网站 */
  source: string;
}

/**
 * 爬虫策略接口
 */
export interface ICrawlerStrategy {
  /** 策略名称 */
  readonly name: string;

  /** 网站 URL */
  readonly baseUrl: string;

  /**
   * 生成搜索 URL
   * @param keyword 关键词
   * @returns {string} 搜索 URL
   */
  // 这是可选的属性，并非必须生成搜索 URL
  generateUrl?: (keyword?: string) => string;

  /**
   * 爬取职位列表
   * @param page 浏览器页面实例
   * @param options 爬取选项
   */
  crawl(page: Page, options?: ICrawlOptions): Promise<IJob[]>;

  /**
   * 提取职位信息
   * @param page 浏览器页面实例
   * @param maxResults 最大爬取数量
   * @returns {Promise<IJob[]>} 职位信息列表
   */
  extractJobs(page: Page, maxResults: number): Promise<IJob[]>;
}

/**
 * 爬取选项
 */
export interface ICrawlOptions {
  /** 关键词搜索 */
  keyword?: string;
  /** 最大爬取数量 */
  maxResults?: number;
  /** 其他自定义选项 */
  [key: string]: any;
}
