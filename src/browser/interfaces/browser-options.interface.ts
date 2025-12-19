import { Browser, BrowserContext, Page, LaunchOptions } from 'playwright';

/**
 * 浏览器启动选项
 */
export interface IBrowserLaunchOptions extends LaunchOptions {
  /** 是否使用无头模式 */
  headless?: boolean;
  /** 浏览器类型: chromium, firefox, webkit */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  /** 用户代理 */
  userAgent?: string;
  /** 视口大小 */
  viewport?: {
    width: number;
    height: number;
  };
  /** 是否忽略 HTTPS 错误 */
  ignoreHTTPSErrors?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 页面导航选项
 */
export interface IPageNavigationOptions {
  /** 等待方式: 'load' | 'domcontentloaded' | 'networkidle' */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 选择器选项
 */
export interface ISelectorOptions {
  /** 等待超时时间（毫秒） */
  timeout?: number;
  /** 是否可见 */
  visible?: boolean;
  /** 是否隐藏 */
  hidden?: boolean;
}

/**
 * 浏览器实例
 */
export interface IBrowserInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
  lastUsedAt: Date;
  isIdle: boolean;
}
