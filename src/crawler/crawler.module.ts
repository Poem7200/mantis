import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { RemoteOkStrategy } from './strategies/remoteok-strategy';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [BrowserModule],
  providers: [CrawlerService, RemoteOkStrategy],
  exports: [CrawlerService],
})
export class CrawlerModule {}
