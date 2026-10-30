import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphEngineService } from './graph-engine.service.js';
import { SessionGuard, AuthenticatedSessionRequest } from '../auth/session.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { AnalysisService } from '../analysis/analysis.service.js';
import { FeatureQueryDto } from './dto/feature-query.dto.js';
import type {
  RepositoryDto,
  RepositoryDashboardDto,
  FeatureItemDto,
  FeatureQuestionResponseDto,
  ArchitectureTopologyDto,
  BlastRadiusResultDto,
} from '@repo-doctor/shared';

@Controller('api/repositories')
@UseGuards(SessionGuard)
export class GraphEngineController {
  constructor(
    private readonly graphService: GraphEngineService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Get()
  async listRepositories(
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<readonly RepositoryDto[]> {
    const userId = req.user.username || req.user.id;
    const githubToken = req.session?.githubAccessToken;
    const gitlabToken = req.session?.gitlabAccessToken;
    return this.graphService.listAccessibleRepositories(userId, githubToken, {
      actualUserId: req.user.id,
      gitlabToken,
      githubUsername: req.user.githubUsername ?? req.session?.githubUsername,
      gitlabUsername: req.user.gitlabUsername ?? req.session?.gitlabUsername,
    });
  }

  @Post(':id/analyze')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async analyzeRepository(
    @Param('id') repositoryId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<RepositoryDashboardDto> {
    const token = req.session?.githubAccessToken;
    if (!token) {
      throw new UnauthorizedException(
        'GitHub account is not connected. Please authorize with GitHub to analyze repositories.',
      );
    }
    await this.analysisService.analyzeRepository(
      repositoryId,
      token,
    );
    return this.graphService.getRepositoryDashboard(repositoryId, req.user);
  }

  @Get(':id/dashboard')
  async getDashboard(
    @Param('id') repositoryId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<RepositoryDashboardDto> {
    return this.graphService.getRepositoryDashboard(repositoryId, req.user);
  }

  @Get(':id/features')
  async getFeatures(
    @Param('id') repositoryId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<readonly FeatureItemDto[]> {
    return this.graphService.getFeatures(repositoryId, req.user);
  }

  @Post(':id/features/:nodeId/query')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async queryFeature(
    @Param('id') repositoryId: string,
    @Param('nodeId') nodeId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<FeatureQuestionResponseDto> {
    const dto = new FeatureQueryDto(body as Partial<FeatureQueryDto>);
    return this.graphService.askFeatureQuestion(repositoryId, nodeId, dto.question, req.user);
  }

  @Get(':id/topology')
  async getTopology(
    @Param('id') repositoryId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ArchitectureTopologyDto> {
    return this.graphService.getTopology(repositoryId, req.user);
  }

  @Get(':id/blast-radius/:nodeId')
  async getBlastRadius(
    @Param('id') repositoryId: string,
    @Param('nodeId') nodeId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<BlastRadiusResultDto> {
    return this.graphService.getBlastRadius(repositoryId, nodeId, req.user);
  }
}
