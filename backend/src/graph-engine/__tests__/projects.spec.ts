import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from '../projects.service.js';
import { ProjectEntity } from '../entities/project.entity.js';
import { RepositoryEntity } from '../entities/repository.entity.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockProjectRepo: any;
  let mockRepoRepo: any;
  let storedProjects: ProjectEntity[];
  let storedRepositories: RepositoryEntity[];

  beforeEach(() => {
    storedProjects = [];
    storedRepositories = [
      {
        id: 'repo-1',
        githubOrg: 'org-a',
        name: 'service-a',
        defaultBranch: 'main',
        lastCommitSha: 'sha-1',
        projectId: null,
        ownerId: null,
        updatedAt: new Date(),
      } as RepositoryEntity,
    ];

    let idCounter = 0;
    mockProjectRepo = {
      create: vi.fn((data: Partial<ProjectEntity>) => ({
        id: `proj-${Date.now()}-${++idCounter}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        repositories: [],
        ...data,
      } as ProjectEntity)),
      save: vi.fn(async (proj: ProjectEntity) => {
        const idx = storedProjects.findIndex((p) => p.id === proj.id);
        if (idx >= 0) {
          storedProjects[idx] = proj;
        } else {
          storedProjects.push(proj);
        }
        return proj;
      }),
      find: vi.fn(async ({ where }: { where: Partial<ProjectEntity> }) => {
        return storedProjects.filter((p) => p.ownerId === where.ownerId);
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<ProjectEntity> }) => {
        return storedProjects.find((p) => p.id === where.id) || null;
      }),
      findOneOrFail: vi.fn(async ({ where }: { where: Partial<ProjectEntity> }) => {
        const found = storedProjects.find((p) => p.id === where.id);
        if (!found) throw new Error('Not found');
        return found;
      }),
    };

    mockRepoRepo = {
      findOne: vi.fn(async ({ where }: { where: Partial<RepositoryEntity> }) => {
        return storedRepositories.find((r) => r.id === where.id) || null;
      }),
      find: vi.fn(async ({ where }: { where?: Partial<RepositoryEntity> }) => {
        if (!where) return storedRepositories;
        return storedRepositories.filter((r) => {
          if (where.projectId !== undefined && r.projectId !== where.projectId) return false;
          return true;
        });
      }),
      save: vi.fn(async (repo: RepositoryEntity) => {
        const idx = storedRepositories.findIndex((r) => r.id === repo.id);
        if (idx >= 0) storedRepositories[idx] = repo;
        return repo;
      }),
    };

    service = new ProjectsService(mockProjectRepo, mockRepoRepo);
  });

  describe('createProject', () => {
    it('creates a project with a valid name', async () => {
      const proj = await service.createProject('user-1', {
        name: 'Backend Microservices',
        description: 'Core platform architecture',
      });

      expect(proj.id).toBeDefined();
      expect(proj.name).toBe('Backend Microservices');
      expect(proj.description).toBe('Core platform architecture');
      expect(proj.ownerId).toBe('user-1');
      expect(proj.repositoryCount).toBe(0);
    });

    it('rejects project creation with empty name', async () => {
      await expect(
        service.createProject('user-1', { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listUserProjects', () => {
    it('returns only projects owned by the requesting user', async () => {
      await service.createProject('user-1', { name: 'Project 1' });
      await service.createProject('user-1', { name: 'Project 2' });
      await service.createProject('user-2', { name: 'Other User Project' });

      const user1Projects = await service.listUserProjects('user-1');
      expect(user1Projects).toHaveLength(2);
      expect(user1Projects.map((p) => p.name)).toEqual(['Project 1', 'Project 2']);
    });
  });

  describe('getProject', () => {
    it('throws ForbiddenException when accessing another user\'s project', async () => {
      const proj = await service.createProject('user-1', { name: 'Private System' });

      await expect(
        service.getProject('user-2', proj.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent project ID', async () => {
      await expect(
        service.getProject('user-1', 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addRepositoryToProject', () => {
    it('associates an existing repository with the project', async () => {
      const proj = await service.createProject('user-1', { name: 'My System' });

      // Associate repo-1
      const updated = await service.addRepositoryToProject('user-1', proj.id, 'repo-1');
      expect(storedRepositories[0].projectId).toBe(proj.id);
      expect(storedRepositories[0].ownerId).toBe('user-1');
    });
  });

  describe('setProjectRepositories and unlinkRepository', () => {
    it('manages multiple repository selections and unlinks safely', async () => {
      const proj = await service.createProject('user-1', { name: 'Multi-Repo Project' });

      // Add a second stored repository
      storedRepositories.push({
        id: 'repo-2',
        githubOrg: 'org-b',
        name: 'service-b',
        defaultBranch: 'main',
        lastCommitSha: null,
        projectId: null,
        ownerId: null,
        updatedAt: new Date(),
      } as RepositoryEntity);

      // Link both repositories at once
      const updated = await service.setProjectRepositories('user-1', proj.id, ['repo-1', 'repo-2']);
      expect(storedRepositories[0].projectId).toBe(proj.id);
      expect(storedRepositories[1].projectId).toBe(proj.id);

      // Deselect repo-1 and select only repo-2
      await service.setProjectRepositories('user-1', proj.id, ['repo-2']);
      expect(storedRepositories[0].projectId).toBeNull();
      expect(storedRepositories[1].projectId).toBe(proj.id);

      // Empty repository selection is supported
      await service.setProjectRepositories('user-1', proj.id, []);
      expect(storedRepositories[0].projectId).toBeNull();
      expect(storedRepositories[1].projectId).toBeNull();

      // Relink repo-2
      await service.setProjectRepositories('user-1', proj.id, ['repo-2']);
      expect(storedRepositories[1].projectId).toBe(proj.id);

      // Unlink one repository via unlinkRepository
      const unlinked = await service.unlinkRepository('user-1', proj.id, 'repo-2');
      expect(storedRepositories[1].projectId).toBeNull();
      // Ensure repo-2 data was NOT deleted
      expect(storedRepositories[1].id).toBe('repo-2');
    });

    it('rejects assigning a repository that belongs to another project', async () => {
      const projA = await service.createProject('user-1', { name: 'Project A' });
      const projB = await service.createProject('user-1', { name: 'Project B' });

      // Assign repo-1 to Project A
      await service.setProjectRepositories('user-1', projA.id, ['repo-1']);
      expect(storedRepositories[0].projectId).toBe(projA.id);

      // Attempt to assign repo-1 to Project B should reject with BadRequestException
      await expect(
        service.setProjectRepositories('user-1', projB.id, ['repo-1']),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-existent repository IDs', async () => {
      const proj = await service.createProject('user-1', { name: 'Valid Project' });

      await expect(
        service.setProjectRepositories('user-1', proj.id, ['non-existent-repo-id']),
      ).rejects.toThrow(NotFoundException);
    });

    it('denies repository management to unauthorized users', async () => {
      const proj = await service.createProject('user-1', { name: 'Auth Project' });

      await expect(
        service.setProjectRepositories('user-2', proj.id, ['repo-1']),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.unlinkRepository('user-2', proj.id, 'repo-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('askProjectQuestion', () => {
    it('returns honest limitation when project has no repositories or no analysis', async () => {
      const proj = await service.createProject('user-1', { name: 'Empty Project' });

      const res = await service.askProjectQuestion('user-1', proj.id, {
        question: 'How does user signup work?',
      });

      expect(res.answer).toContain('This project currently has no repositories linked');
      expect(res.limitations).toHaveLength(1);
    });
  });
});
