import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
  Inject,
} from '@nestjs/common';
import { Browser, BrowserContext, Page } from 'playwright';
import { BrowserService } from './browser.service';
import {
  IBrowserInstance,
  IBrowserLaunchOptions,
} from './interfaces/browser-options.interface';

@Injectable()
export class BrowserPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private readonly pool: Map<string, IBrowserInstance> = new Map();
  private readonly maxPoolSize: number;
  private readonly idleTimeout: number; // 空闲超时时间（毫秒）

  constructor(
    private readonly browserService: BrowserService,
    @Optional() @Inject('BROWSER_POOL_MAX_SIZE') maxPoolSize?: number,
    @Optional() @Inject('BROWSER_POOL_IDLE_TIMEOUT') idleTimeout?: number,
  ) {
    this.maxPoolSize = maxPoolSize ?? 5;
    this.idleTimeout = idleTimeout ?? 10 * 60 * 1000; // 默认 10 分钟
    this.startIdleCleanup();
  }

  /**
   * 从池中获取浏览器实例
   */
  async acquire(
    key: string = 'default',
    options?: IBrowserLaunchOptions,
  ): Promise<IBrowserInstance> {
    // 检查池中是否已有可用实例
    const existing = this.pool.get(key);
    if (existing && existing.isIdle) {
      existing.isIdle = false;
      existing.lastUsedAt = new Date();
      this.logger.debug(`复用浏览器实例: ${key}`);
      return existing;
    }

    // 检查池大小限制
    if (this.pool.size >= this.maxPoolSize) {
      this.logger.warn(`浏览器池已满 (${this.maxPoolSize})，等待空闲实例...`);
      // 可以在这里实现等待逻辑或清理最旧的实例
      await this.cleanupOldest();
    }

    // 创建新实例
    const browser = await this.browserService.launch(options);
    const context = await browser.newContext({
      viewport: options?.viewport || { width: 1920, height: 1080 },
      userAgent:
        options?.userAgent ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: options?.ignoreHTTPSErrors ?? true,
    });
    const page = await context.newPage();

    const instance: IBrowserInstance = {
      browser,
      context,
      page,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      isIdle: false,
    };

    this.pool.set(key, instance);
    this.logger.log(`创建新浏览器实例: ${key}, 池大小: ${this.pool.size}`);
    return instance;
  }

  /**
   * 释放浏览器实例回池
   */
  async release(key: string = 'default'): Promise<void> {
    const instance = this.pool.get(key);
    if (!instance) {
      this.logger.warn(`尝试释放不存在的实例: ${key}`);
      return;
    }

    // 关闭当前页面的所有标签页（除了主页面）
    const pages = instance.context.pages();
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }

    instance.isIdle = true;
    instance.lastUsedAt = new Date();
    this.logger.debug(`释放浏览器实例: ${key}`);
  }

  /**
   * 获取实例的页面
   */
  getPage(key: string = 'default'): Page | null {
    const instance = this.pool.get(key);
    return instance?.page || null;
  }

  /**
   * 获取实例
   */
  getInstance(key: string = 'default'): IBrowserInstance | null {
    return this.pool.get(key) || null;
  }

  /**
   * 创建新页面
   */
  async newPage(key: string = 'default'): Promise<Page> {
    const instance = this.pool.get(key);
    if (!instance) {
      throw new Error(`浏览器实例不存在: ${key}`);
    }
    return await instance.context.newPage();
  }

  /**
   * 关闭并移除实例
   */
  async remove(key: string = 'default'): Promise<void> {
    const instance = this.pool.get(key);
    if (!instance) {
      return;
    }

    try {
      await instance.context.close();
      await instance.browser.close();
      this.pool.delete(key);
      this.logger.log(`移除浏览器实例: ${key}, 剩余池大小: ${this.pool.size}`);
    } catch (error) {
      this.logger.error(`移除浏览器实例失败: ${key}`, error.stack);
    }
  }

  /**
   * 清理最旧的实例
   */
  private async cleanupOldest(): Promise<void> {
    if (this.pool.size === 0) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, instance] of this.pool.entries()) {
      if (instance.isIdle && instance.lastUsedAt.getTime() < oldestTime) {
        oldestTime = instance.lastUsedAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.logger.log(`清理最旧的浏览器实例: ${oldestKey}`);
      await this.remove(oldestKey);
    }
  }

  /**
   * 清理空闲超时的实例
   */
  private async cleanupIdle(): Promise<void> {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const [key, instance] of this.pool.entries()) {
      if (
        instance.isIdle &&
        now - instance.lastUsedAt.getTime() > this.idleTimeout
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.logger.log(`清理空闲超时的浏览器实例: ${key}`);
      await this.remove(key);
    }
  }

  /**
   * 启动空闲清理任务
   */
  private startIdleCleanup(): void {
    // 每 5 分钟检查一次空闲实例
    setInterval(
      () => {
        this.cleanupIdle().catch((error) => {
          this.logger.error('清理空闲实例失败', error.stack);
        });
      },
      5 * 60 * 1000,
    );
  }

  /**
   * 获取池状态
   */
  getPoolStatus(): {
    size: number;
    maxSize: number;
    instances: Array<{
      key: string;
      isIdle: boolean;
      createdAt: Date;
      lastUsedAt: Date;
    }>;
  } {
    return {
      size: this.pool.size,
      maxSize: this.maxPoolSize,
      instances: Array.from(this.pool.entries()).map(([key, instance]) => ({
        key,
        isIdle: instance.isIdle,
        createdAt: instance.createdAt,
        lastUsedAt: instance.lastUsedAt,
      })),
    };
  }

  /**
   * 清空所有实例
   */
  async clear(): Promise<void> {
    const keys = Array.from(this.pool.keys());
    for (const key of keys) {
      await this.remove(key);
    }
    this.logger.log('浏览器池已清空');
  }

  /**
   * 模块销毁时清理所有实例
   */
  async onModuleDestroy(): Promise<void> {
    await this.clear();
  }
}
