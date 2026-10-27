import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { GraphEngineModule } from './graph-engine/graph-engine.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, GraphEngineModule, AnalysisModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
