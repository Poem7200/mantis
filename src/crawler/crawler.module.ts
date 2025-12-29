import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { CrawlerSchedulerService } from './crawler-scheduler.service';
import { RemoteOkStrategy } from './strategies/remoteok-strategy';
import { HimalayasStrategy } from './strategies/himalayas-strategy';
import { WeWorkRemotelyStrategy } from './strategies/weworkremotely-strategy';
import { BrowserModule } from '../browser/browser.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // 启用定时任务模块
    BrowserModule,
    JobsModule, // 需要 JobsService
  ],
  controllers: [CrawlerController],
  providers: [
    CrawlerService,
    CrawlerSchedulerService,
    RemoteOkStrategy,
    HimalayasStrategy,
    WeWorkRemotelyStrategy,
  ],
  exports: [CrawlerService],
})
export class CrawlerModule {}
