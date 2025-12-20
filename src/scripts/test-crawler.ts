import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CrawlerService } from '../crawler/crawler.service';

async function testCrawler() {
  // 创建 NestJS 应用上下文（不需要 HTTP 服务器）
  const app = await NestFactory.createApplicationContext(AppModule);

  // 获取 CrawlerService
  const crawlerService = app.get(CrawlerService);

  try {
    console.log('='.repeat(60));
    console.log('🚀 开始爬取 RemoteOK...');
    console.log('💡 浏览器将以非 headless 模式运行（你可以看到浏览器窗口）');
    console.log('='.repeat(60));
    console.log('');

    // 调用爬虫，设置 headless: false
    const jobs = await crawlerService.crawl('remoteok', {
      headless: false, // 非 headless 模式，可以看到浏览器窗口
      keyword: 'react', // 可选：搜索关键词，不设置则爬取全部
      maxResults: 10, // 可选：最多爬取 10 个职位
    });

    console.log('');
    console.log('='.repeat(60));
    console.log(`✅ 成功爬取 ${jobs.length} 个职位`);
    console.log('='.repeat(60));
    console.log('');

    // 打印结果
    if (jobs.length === 0) {
      console.log('⚠️  没有找到职位信息');
    } else {
      jobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.title}`);
        console.log(`   📌 公司: ${job.company}`);
        console.log(`   📍 位置: ${job.location || 'Remote'}`);
        console.log(`   🏷️  标签: ${job.tags?.join(', ') || 'N/A'}`);
        console.log(`   🔗 链接: ${job.url}`);
        console.log(`   ⏰ 发布时间: ${job.postedAt || 'N/A'}`);
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('✨ 爬取完成！');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('');
    console.error('❌ 爬取失败:');
    if (error instanceof Error) {
      console.error(`   错误信息: ${error.message}`);
      if (error.stack) {
        console.error(`   堆栈信息: ${error.stack}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    // 关闭应用
    await app.close();
    process.exit(0);
  }
}

// 运行测试
void testCrawler();
