import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryEntity } from '../graph-engine/entities/repository.entity.js';
import { SystemNodeEntity } from '../graph-engine/entities/system-node.entity.js';
import { SystemEdgeEntity } from '../graph-engine/entities/system-edge.entity.js';
import { EvidenceEntity } from '../graph-engine/entities/evidence.entity.js';
import { IngestionService } from './ingestion.service.js';
import { AnalyzerService } from './analyzer.service.js';
import { AnalysisService } from './analysis.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RepositoryEntity,
      SystemNodeEntity,
      SystemEdgeEntity,
      EvidenceEntity,
    ]),
  ],
  providers: [IngestionService, AnalyzerService, AnalysisService],
  exports: [IngestionService, AnalyzerService, AnalysisService],
})
export class AnalysisModule {}
