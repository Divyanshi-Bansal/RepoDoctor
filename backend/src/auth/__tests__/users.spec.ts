import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users.service.js';
import { UserEntity } from '../entities/user.entity.js';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: any;
  let storedUsers: UserEntity[];

  beforeEach(() => {
    storedUsers = [];

    mockRepo = {
      findOne: vi.fn(async ({ where }: { where: Partial<UserEntity> }) => {
        return (
          storedUsers.find((u) => {
            if (where.id && u.id === where.id) return true;
            if (where.email && u.email === where.email) return true;
            if (where.githubId && u.githubId === where.githubId) return true;
            if (where.githubUsername && u.githubUsername === where.githubUsername) return true;
            if (where.gitlabUsername && u.gitlabUsername === where.gitlabUsername) return true;
            return false;
          }) || null
        );
      }),
      create: vi.fn((data: Partial<UserEntity>) => {
        return {
          id: `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        } as UserEntity;
      }),
      save: vi.fn(async (user: UserEntity) => {
        const idx = storedUsers.findIndex((u) => u.id === user.id);
        if (idx >= 0) {
          storedUsers[idx] = user;
        } else {
          storedUsers.push(user);
        }
        return user;
      }),
    };

    service = new UsersService(mockRepo);
  });

  describe('createUser', () => {
    it('successfully registers a user with valid credentials and bcrypt hash', async () => {
      const user = await service.createUser({
        name: 'Jane Doe',
        email: 'Jane.Doe@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('jane.doe@example.com');
      expect(user.name).toBe('Jane Doe');

      // Password hash must NOT be in the summary
      expect((user as any).passwordHash).toBeUndefined();

      // Ensure stored user has bcrypt hash
      const stored = storedUsers.find((u) => u.email === 'jane.doe@example.com');
      expect(stored).toBeDefined();
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
      expect(stored?.passwordHash).not.toBe('Password123!');
    });

    it('rejects signup with invalid email format', async () => {
      await expect(
        service.createUser({
          name: 'Invalid Email',
          email: 'not-an-email',
          password: 'Password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects short passwords or passwords lacking letters/numbers', async () => {
      await expect(
        service.createUser({
          name: 'Short Pass',
          email: 'short@example.com',
          password: 'abc',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createUser({
          name: 'No Number Pass',
          email: 'nonum@example.com',
          password: 'abcdefghij',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects password confirmation mismatch', async () => {
      await expect(
        service.createUser({
          name: 'Mismatch Pass',
          email: 'mismatch@example.com',
          password: 'Password123',
          confirmPassword: 'Password456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate email addresses with ConflictException', async () => {
      await service.createUser({
        name: 'First User',
        email: 'duplicate@example.com',
        password: 'Password123',
      });

      await expect(
        service.createUser({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'AnotherPassword456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateCredentials', () => {
    beforeEach(async () => {
      await service.createUser({
        name: 'Login User',
        email: 'login@example.com',
        password: 'SecurePassword123',
      });
    });

    it('validates correct email and password', async () => {
      const summary = await service.validateCredentials('login@example.com', 'SecurePassword123');
      expect(summary.email).toBe('login@example.com');
      expect(summary.name).toBe('Login User');
    });

    it('rejects incorrect password with UnauthorizedException', async () => {
      await expect(
        service.validateCredentials('login@example.com', 'WrongPassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects non-existent email with UnauthorizedException', async () => {
      await expect(
        service.validateCredentials('nobody@example.com', 'SecurePassword123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('OAuth account linking', () => {
    it('creates a new user for GitHub OAuth login when not existing', async () => {
      const user = await service.findOrCreateGitHubUser(
        '998877',
        'octo-user',
        'Octo Cat',
        'octo@github.com',
      );

      expect(user.id).toBeDefined();
      expect(user.githubId).toBe('998877');
      expect(user.githubUsername).toBe('octo-user');
      expect(user.email).toBe('octo@github.com');
    });

    it('links GitHub credentials to an existing local user', async () => {
      const localUser = await service.createUser({
        name: 'Local Dev',
        email: 'dev@example.com',
        password: 'Password123',
      });

      const updated = await service.linkGitHubAccount(localUser.id, '123456', 'git-dev');
      expect(updated.id).toBe(localUser.id);
      expect(updated.githubUsername).toBe('git-dev');
    });

    it('creates a new user for GitLab OAuth login when not existing', async () => {
      const user = await service.findOrCreateGitLabUser(
        'tanuki-dev',
        'Tanuki Dev',
        'tanuki@gitlab.com',
      );

      expect(user.id).toBeDefined();
      expect(user.gitlabUsername).toBe('tanuki-dev');
      expect(user.email).toBe('tanuki@gitlab.com');
    });

    it('links GitLab credentials to an existing local user', async () => {
      const localUser = await service.createUser({
        name: 'Local Tanuki Dev',
        email: 'localtanuki@example.com',
        password: 'Password123',
      });

      const updated = await service.linkGitLabAccount(localUser.id, 'tanuki-linked');
      expect(updated.id).toBe(localUser.id);
      expect(updated.gitlabUsername).toBe('tanuki-linked');
    });
  });
});
