import { Module } from '@nestjs/common';
import { BrowserModule } from './browser/browser.module';

@Module({
  imports: [BrowserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
