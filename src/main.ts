import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DEFAULT_PORT } from 'src/config/constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}
void bootstrap();
