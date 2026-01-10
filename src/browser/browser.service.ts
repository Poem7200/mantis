import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
  firefox,
  webkit,
} from 'playwright';
import {
  IBrowserLaunchOptions,
  IPageNavigationOptions,
  ISelectorOptions,
} from './interfaces/browser-options.interface';
import {
  DEFAULT_BROWSER_HEADLESS,
  DEFAULT_BROWSER_TYPE,
  DEFAULT_VIEWPORT,
  DEFAULT_IGNORE_HTTPS_ERRORS,
  DEFAULT_BROWSER_TIMEOUT,
  DEFAULT_USER_AGENT,
  DEFAULT_WAIT_UNTIL,
  DEFAULT_NETWORK_IDLE_TIMEOUT,
} from '../config/constants';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * 启动浏览器
   */
  async launch(options: IBrowserLaunchOptions = {}): Promise<Browser> {
    try {
      const {
        headless = DEFAULT_BROWSER_HEADLESS,
        browserType = DEFAULT_BROWSER_TYPE,
        userAgent,
        viewport = DEFAULT_VIEWPORT,
        ignoreHTTPSErrors = DEFAULT_IGNORE_HTTPS_ERRORS,
        timeout = DEFAULT_BROWSER_TIMEOUT,
        ...launchOptions
      } = options;

      this.logger.log(`启动浏览器: ${browserType}, headless: ${headless}`);

      const browserLauncher =
        browserType === 'chromium'
          ? chromium
          : browserType === 'firefox'
            ? firefox
            : webkit;

      this.browser = await browserLauncher.launch({
        headless,
        ...launchOptions,
      });

      // 创建浏览器上下文，该上下文有独立的缓存
      this.context = await this.browser.newContext({
        viewport: viewport || DEFAULT_VIEWPORT,
        userAgent: userAgent || DEFAULT_USER_AGENT,
        ignoreHTTPSErrors,
      });

      this.logger.log('浏览器启动成功');
      return this.browser;
    } catch (error) {
      this.logger.error(`浏览器启动失败: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  /**
   * 创建新页面
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('浏览器上下文未初始化，请先调用 launch()');
    }

    const page = await this.context.newPage();
    this.logger.debug('创建新页面');
    return page;
  }

  /**
   * 导航到指定 URL（包含指定等待标准和超时时间）
   */
  async goto(
    page: Page,
    url: string,
    options: IPageNavigationOptions = {},
  ): Promise<void> {
    try {
      const {
        waitUntil = DEFAULT_WAIT_UNTIL,
        timeout = DEFAULT_BROWSER_TIMEOUT,
      } = options;

      this.logger.debug(`导航到: ${url}`);
      await page.goto(url, {
        waitUntil,
        timeout,
      });
      this.logger.debug(`页面加载完成: ${url}`);
    } catch (error) {
      this.logger.error(`页面导航失败: ${url}`, error?.stack);
      throw error;
    }
  }

  /**
   * 等待选择器出现
   */
  async waitForSelector(
    page: Page,
    selector: string,
    options: ISelectorOptions = {},
  ): Promise<void> {
    const { timeout = DEFAULT_BROWSER_TIMEOUT, visible, hidden } = options;

    try {
      // waitForSelector 方法会等待选择器出现在页面上，如果选择器不存在，则会等待 timeout 时间后抛出错误
      await page.waitForSelector(selector, {
        timeout,
        // TODO: state需要优化，建议使用策略模式
        state: visible ? 'visible' : hidden ? 'hidden' : undefined,
      });
    } catch (error) {
      this.logger.error(`等待选择器超时: ${selector}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取元素文本内容
   */
  async getText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (!element) {
        return null;
      }
      return await element.textContent();
    } catch (error) {
      this.logger.error(`获取文本失败: ${selector}`, error.stack);
      return null;
    }
  }

  /**
   * 获取多个元素的文本内容
   */
  async getTexts(page: Page, selector: string): Promise<string[]> {
    try {
      return await page.$$eval(selector, (elements) =>
        elements.map((el) => el.textContent?.trim() || ''),
      );
    } catch (error) {
      this.logger.error(`获取多个文本失败: ${selector}`, error.stack);
      return [];
    }
  }

  /**
   * 获取元素属性
   */
  async getAttribute(
    page: Page,
    selector: string,
    attribute: string,
  ): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (!element) {
        return null;
      }
      return await element.getAttribute(attribute);
    } catch (error) {
      this.logger.error(`获取属性失败: ${selector}, ${attribute}`, error.stack);
      return null;
    }
  }

  /**
   * 获取多个元素的属性
   */
  async getAttributes(
    page: Page,
    selector: string,
    attribute: string,
  ): Promise<string[]> {
    try {
      return await page.$$eval(
        selector,
        (elements, attr) => elements.map((el) => el.getAttribute(attr) || ''),
        attribute,
      );
    } catch (error) {
      this.logger.error(
        `获取多个属性失败: ${selector}, ${attribute}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * 点击元素
   */
  async click(
    page: Page,
    selector: string,
    options?: { timeout?: number },
  ): Promise<void> {
    try {
      await page.click(selector, options);
    } catch (error) {
      this.logger.error(`点击元素失败: ${selector}`, error.stack);
      throw error;
    }
  }

  /**
   * 输入文本
   */
  async type(
    page: Page,
    selector: string,
    text: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    try {
      await page.fill(selector, text, options);
    } catch (error) {
      this.logger.error(`输入文本失败: ${selector}`, error.stack);
      throw error;
    }
  }

  /**
   * 滚动页面
   */
  async scroll(
    page: Page,
    options?: { x?: number; y?: number },
  ): Promise<void> {
    try {
      await page.evaluate((opts) => {
        window.scrollTo(opts.x || 0, opts.y || 0);
      }, options || {});
    } catch (error) {
      this.logger.error('滚动页面失败', error.stack);
      throw error;
    }
  }

  /**
   * 滚动到底部
   */
  async scrollToBottom(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    } catch (error) {
      this.logger.error('滚动到底部失败', error.stack);
      throw error;
    }
  }

  /**
   * 等待网络空闲
   */
  async waitForNetworkIdle(
    page: Page,
    timeout: number = DEFAULT_NETWORK_IDLE_TIMEOUT,
  ): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
      this.logger.warn('等待网络空闲超时', error.stack);
    }
  }

  /**
   * 执行 JavaScript 代码
   */
  async evaluate<T>(page: Page, fn: () => T | Promise<T>): Promise<T> {
    try {
      return await page.evaluate(fn);
    } catch (error) {
      this.logger.error('执行 JavaScript 失败', error.stack);
      throw error;
    }
  }

  /**
   * 截图
   */
  async screenshot(
    page: Page,
    options?: {
      path?: string;
      fullPage?: boolean;
      type?: 'png' | 'jpeg';
    },
  ): Promise<Buffer> {
    try {
      return await page.screenshot(options);
    } catch (error) {
      this.logger.error('截图失败', error.stack);
      throw error;
    }
  }

  /**
   * 获取当前 URL
   */
  async getCurrentUrl(page: Page): Promise<string> {
    return page.url();
  }

  /**
   * 获取页面标题
   */
  async getTitle(page: Page): Promise<string> {
    return await page.title();
  }

  /**
   * 关闭页面
   */
  async closePage(page: Page): Promise<void> {
    try {
      await page.close();
      this.logger.debug('页面已关闭');
    } catch (error) {
      this.logger.error('关闭页面失败', error.stack);
    }
  }

  /**
   * 关闭浏览器上下文
   */
  async closeContext(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
        this.context = null;
        this.logger.log('浏览器上下文已关闭');
      } catch (error) {
        this.logger.error('关闭浏览器上下文失败', error.stack);
      }
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    await this.closeContext();

    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.logger.log('浏览器已关闭');
      } catch (error) {
        this.logger.error('关闭浏览器失败', error.stack);
      }
    }
  }

  /**
   * 获取浏览器实例
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * 获取浏览器上下文
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * 模块销毁时关闭浏览器
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
