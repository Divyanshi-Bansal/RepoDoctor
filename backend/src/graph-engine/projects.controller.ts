import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { SessionGuard, AuthenticatedSessionRequest } from '../auth/session.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import type {
  ProjectDto,
  CreateProjectDto,
  SetProjectRepositoriesDto,
  ProjectAnalysisResultDto,
  ProjectDashboardDto,
  ProjectArchitectureDto,
  AskRepoDoctorQueryDto,
  AskRepoDoctorResponseDto,
} from '@repo-doctor/shared';

@Controller('api/projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects(
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<readonly ProjectDto[]> {
    return this.projectsService.listUserProjects(req.user.id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @Body() dto: CreateProjectDto,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.createProject(req.user.id, dto);
  }

  @Get(':id')
  async getProject(
    @Param('id') projectId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.getProject(req.user.id, projectId);
  }

  @Put(':id/repositories')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async setProjectRepositories(
    @Param('id') projectId: string,
    @Body() dto: SetProjectRepositoriesDto,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectDto> {
    const repoIds = Array.isArray(dto?.repositoryIds) ? dto.repositoryIds : [];
    return this.projectsService.setProjectRepositories(req.user.id, projectId, repoIds);
  }

  @Post(':id/repositories/:repoId')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async addRepository(
    @Param('id') projectId: string,
    @Param('repoId') repoId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.addRepositoryToProject(req.user.id, projectId, repoId);
  }

  @Delete(':id/repositories/:repoId')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async unlinkRepository(
    @Param('id') projectId: string,
    @Param('repoId') repoId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectDto> {
    return this.projectsService.unlinkRepository(req.user.id, projectId, repoId);
  }

  @Post(':id/analyze')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async analyzeProject(
    @Param('id') projectId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectAnalysisResultDto> {
    const token = req.session?.githubAccessToken;
    if (!token) {
      throw new UnauthorizedException(
        'GitHub account is not connected. Please authorize with GitHub to analyze project repositories.',
      );
    }
    return this.projectsService.analyzeProject(req.user.id, projectId, token);
  }

  @Get(':id/dashboard')
  async getProjectDashboard(
    @Param('id') projectId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectDashboardDto> {
    return this.projectsService.getProjectDashboard(req.user.id, projectId);
  }

  @Get(':id/architecture')
  async getProjectArchitecture(
    @Param('id') projectId: string,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<ProjectArchitectureDto> {
    return this.projectsService.getProjectArchitecture(req.user.id, projectId);
  }

  @Post(':id/query')
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async askQuestion(
    @Param('id') projectId: string,
    @Body() dto: AskRepoDoctorQueryDto,
    @Req() req: AuthenticatedSessionRequest,
  ): Promise<AskRepoDoctorResponseDto> {
    return this.projectsService.askProjectQuestion(req.user.id, projectId, dto);
  }
}
