import { Module } from '@nestjs/common';
import { BrowserModule } from './browser/browser.module';
import { CrawlerModule } from './crawler/crawler.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BrowserModule,
    CrawlerModule,
    JobsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
