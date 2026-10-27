/**
 * NestJS DatabaseModule — configures TypeOrmModule.forRootAsync using
 * the shared buildDataSourceOptions() factory.
 *
 * ConfigService usage is deferred to Milestone 3 when @nestjs/config is wired.
 * For Milestone 2, DB credentials are read from environment variables by
 * buildDataSourceOptions() (default to docker-compose dev values).
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './data-source.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...buildDataSourceOptions(),
      autoLoadEntities: true,
    }),
  ],
})
export class DatabaseModule {}
