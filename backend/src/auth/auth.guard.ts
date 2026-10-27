import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositoryEntity } from '../graph-engine/entities/repository.entity.js';
import { AuthService } from './auth.service.js';
import {
  RepositoryAccessDeniedException,
  RepositoryNotFoundException,
} from '../common/exceptions/domain.exceptions.js';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  user?: {
    id: string;
    username: string;
  };
  repository?: RepositoryEntity;
}

@Injectable()
export class RepositoryAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(RepositoryEntity)
    private readonly repoRepository: Repository<RepositoryEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    
    // Extract user ID from header 'x-user-id', or default to 'dev-user'
    const rawUserId = request.headers['x-user-id'];
    const userId = (Array.isArray(rawUserId) ? rawUserId[0] : rawUserId) || 'dev-user';
    
    const user = this.authService.getUser(userId);
    if (!user) {
      throw new RepositoryAccessDeniedException('unknown', userId);
    }

    request.user = {
      id: user.id,
      username: user.username,
    };

    // Check if the route has a repository identifier in route params
    const repositoryId = request.params['id'] || request.params['repositoryId'];
    if (!repositoryId) {
      return true; // No specific repo scoped to this route (e.g. list accessible repos)
    }

    const repository = await this.repoRepository.findOne({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new RepositoryNotFoundException(repositoryId);
    }

    const isAuthorized = this.authService.isAuthorizedForRepository(user.id, repository);
    if (!isAuthorized) {
      throw new RepositoryAccessDeniedException(repository.id, user.id);
    }

    request.repository = repository;
    return true;
  }
}
