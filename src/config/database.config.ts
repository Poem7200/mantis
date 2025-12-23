import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USER', 'postgres'),
  password: configService.get<string>('DB_PASSWORD', 'postgres'),
  database: configService.get<string>('DB_NAME', 'remote_jobs'),
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  synchronize: configService.get<string>('NODE_ENV') !== 'production', // 生产环境应为 false
  logging: configService.get<string>('NODE_ENV') === 'development',
});
