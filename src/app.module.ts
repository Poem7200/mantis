import { Module } from '@nestjs/common';
import { BrowserModule } from 'src/browser/browser.module';
import { CrawlerModule } from 'src/crawler/crawler.module';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { JobsModule } from 'src/jobs/jobs.module';

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
