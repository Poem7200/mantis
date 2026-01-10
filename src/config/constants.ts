// 默认获取的职位数量上限
export const DEFAULT_MAX_RESULTS = 50;

// 服务器配置
export const DEFAULT_PORT = 3000;

// 浏览器配置
export const DEFAULT_BROWSER_HEADLESS = true;
export const DEFAULT_BROWSER_TYPE = 'chromium';
export const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
export const DEFAULT_IGNORE_HTTPS_ERRORS = true;
export const DEFAULT_BROWSER_TIMEOUT = 30000;
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const DEFAULT_WAIT_UNTIL = 'networkidle';
export const DEFAULT_NETWORK_IDLE_TIMEOUT = 5000;

// 浏览器池配置
export const DEFAULT_BROWSER_POOL_MAX_SIZE = 5;
export const DEFAULT_BROWSER_POOL_IDLE_TIMEOUT = 10 * 60 * 1000; // 10分钟
export const DEFAULT_BROWSER_POOL_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟

// 爬虫配置
export const DEFAULT_CRAWLER_HEADLESS = false;
export const DEFAULT_PAGE_TIMEOUT = 30000;
export const DEFAULT_SELECTOR_TIMEOUT = 10000;
export const DEFAULT_SCROLL_WAIT_TIMEOUT = 2000;

// 爬虫调度器配置
export const DEFAULT_TIMEZONE = 'Asia/Shanghai';
export const DEFAULT_CRAWL_STRATEGY = 'remoteok';
export const DEFAULT_CRAWL_MAX_RESULTS_SCHEDULER = 100;
export const DEFAULT_CRAWL_KEYWORD = 'javascript';
