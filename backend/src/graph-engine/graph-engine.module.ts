/**
 * NestJS GraphEngineModule.
 * Declares TypeORM repositories, services, and controllers for graph-engine.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryEntity } from './entities/repository.entity.js';
import { SystemNodeEntity } from './entities/system-node.entity.js';
import { SystemEdgeEntity } from './entities/system-edge.entity.js';
import { EvidenceEntity } from './entities/evidence.entity.js';
import { CodeEmbeddingEntity } from './entities/code-embedding.entity.js';
import { ProjectEntity } from './entities/project.entity.js';
import { GraphEngineService } from './graph-engine.service.js';
import { GraphEngineController } from './graph-engine.controller.js';
import { ProjectsService } from './projects.service.js';
import { ProjectsController } from './projects.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { AnalysisModule } from '../analysis/analysis.module.js';

/** All graph-engine entities registered with the NestJS TypeORM feature module. */
export const GRAPH_ENGINE_ENTITY_CLASSES = [
  RepositoryEntity,
  SystemNodeEntity,
  SystemEdgeEntity,
  EvidenceEntity,
  CodeEmbeddingEntity,
  ProjectEntity,
];

@Module({
  imports: [
    TypeOrmModule.forFeature(GRAPH_ENGINE_ENTITY_CLASSES),
    AuthModule,
    AnalysisModule,
  ],
  providers: [GraphEngineService, ProjectsService],
  controllers: [GraphEngineController, ProjectsController],
  exports: [TypeOrmModule, GraphEngineService, ProjectsService],
})
export class GraphEngineModule {}
