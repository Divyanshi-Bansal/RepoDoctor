import { Injectable } from '@nestjs/common';
import { RepositoryEntity } from '../graph-engine/entities/repository.entity.js';

export interface AuthUser {
  readonly id: string;
  readonly username: string;
  readonly authorizedOrgs: readonly string[];
  readonly authorizedRepoIds?: readonly string[];
}

@Injectable()
export class AuthService {
  // Pre-configured authorization matrix for developers & organizations
  private readonly users: ReadonlyMap<string, AuthUser> = new Map([
    [
      'dev-user',
      {
        id: 'dev-user',
        username: 'octocat-dev',
        authorizedOrgs: ['repodoctor', 'acme-corp'],
      },
    ],
    [
      'alice',
      {
        id: 'alice',
        username: 'alice-architect',
        authorizedOrgs: ['repodoctor'],
      },
    ],
    [
      'guest-user',
      {
        id: 'guest-user',
        username: 'guest',
        authorizedOrgs: [],
      },
    ],
  ]);

  getUser(userId: string): AuthUser | undefined {
    return this.users.get(userId);
  }

  isAuthorizedForRepository(userId: string, repository: RepositoryEntity): boolean {
    const user = this.getUser(userId);
    if (!user) {
      return false;
    }

    // Direct repo ID authorization (if specified)
    if (user.authorizedRepoIds?.includes(repository.id)) {
      return true;
    }

    // Organization-level access check (case-insensitive)
    const orgMatch = user.authorizedOrgs.some(
      (org) => org.toLowerCase() === repository.githubOrg.toLowerCase(),
    );

    return orgMatch;
  }
}
