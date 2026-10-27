import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryEntity } from '../graph-engine/entities/repository.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { RepositoryAuthGuard } from './auth.guard.js';
import { GitHubOAuthService } from './github-oauth.service.js';
import { GitLabOAuthService } from './gitlab-oauth.service.js';
import { UsersService } from './users.service.js';
import { SessionStore } from './session.store.js';
import { SessionGuard } from './session.guard.js';
import { CsrfGuard } from './csrf.guard.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([RepositoryEntity, UserEntity])],
  controllers: [AuthController],
  providers: [
    AuthService,
    RepositoryAuthGuard,
    GitHubOAuthService,
    GitLabOAuthService,
    UsersService,
    SessionStore,
    SessionGuard,
    CsrfGuard,
  ],
  exports: [
    AuthService,
    RepositoryAuthGuard,
    GitHubOAuthService,
    GitLabOAuthService,
    UsersService,
    SessionStore,
    SessionGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
