import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from 'src/config/database.config';
import { Job } from 'src/jobs/entities/job.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Job]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
