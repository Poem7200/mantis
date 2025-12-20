import { Module } from '@nestjs/common';
import { BrowserModule } from './browser/browser.module';
import { CrawlerModule } from './crawler/crawler.module';

@Module({
  imports: [BrowserModule, CrawlerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
