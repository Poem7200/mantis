import { Module, Global } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { BrowserPoolService } from './browser-pool.service';

@Global()
@Module({
  providers: [BrowserService, BrowserPoolService],
  exports: [BrowserService, BrowserPoolService],
})
export class BrowserModule {}
