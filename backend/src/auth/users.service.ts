import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './entities/user.entity.js';

export interface UserSummaryDto {
  id: string;
  email: string;
  name: string;
  githubUsername: string | null;
  gitlabUsername: string | null;
  createdAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Validates signup parameters, normalizes email, checks uniqueness,
   * hashes password with bcrypt, and persists the user.
   */
  async createUser(dto: CreateUserDto): Promise<UserSummaryDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Name is required');
    }

    const email = dto.email?.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('A valid email address is required');
    }

    const password = dto.password;
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('Password must contain at least one letter and one number');
    }

    if (dto.confirmPassword !== undefined && password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = this.userRepo.create({
      name,
      email,
      passwordHash,
      githubUsername: null,
      githubId: null,
      gitlabUsername: null,
    });

    const saved = await this.userRepo.save(user);
    this.logger.log(`Created new local user account: ${saved.email} (${saved.id})`);

    return this.mapToSummary(saved);
  }

  /**
   * Validates email/password credentials and returns the authenticated user summary.
   */
  async validateCredentials(emailInput: string, passwordInput: string): Promise<UserSummaryDto> {
    const email = emailInput?.trim().toLowerCase();
    if (!email || !passwordInput) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !user.passwordHash) {
      // User doesn't exist or is an OAuth-only user without a password
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(passwordInput, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.mapToSummary(user);
  }

  /**
   * Finds an existing user by GitHub ID / username / email, or creates a new OAuth-linked account.
   */
  async findOrCreateGitHubUser(
    githubId: string,
    githubUsername: string,
    name?: string,
    email?: string,
  ): Promise<UserEntity> {
    let user: UserEntity | null = null;

    if (githubId) {
      user = await this.userRepo.findOne({ where: { githubId } });
    }
    if (!user && githubUsername) {
      user = await this.userRepo.findOne({ where: { githubUsername } });
    }
    if (!user && email) {
      user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    }

    if (user) {
      user.githubId = githubId;
      user.githubUsername = githubUsername;
      if (!user.name && name) {
        user.name = name;
      }
      return await this.userRepo.save(user);
    }

    // Create new GitHub user
    const fallbackEmail = email ? email.toLowerCase() : `${githubUsername.toLowerCase()}@github.repodoctor.local`;
    const newUser = this.userRepo.create({
      name: name || githubUsername,
      email: fallbackEmail,
      passwordHash: null,
      githubId,
      githubUsername,
      gitlabUsername: null,
    });

    return await this.userRepo.save(newUser);
  }

  /**
   * Links a GitHub account to an existing authenticated user.
   */
  async linkGitHubAccount(userId: string, githubId: string, githubUsername: string): Promise<UserSummaryDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.githubId = githubId;
    user.githubUsername = githubUsername;
    const saved = await this.userRepo.save(user);
    return this.mapToSummary(saved);
  }

  /**
   * Finds an existing user by GitLab username / email, or creates a new OAuth-linked account.
   */
  async findOrCreateGitLabUser(
    gitlabUsername: string,
    name?: string,
    email?: string,
  ): Promise<UserEntity> {
    let user: UserEntity | null = null;
    if (gitlabUsername) {
      user = await this.userRepo.findOne({ where: { gitlabUsername } });
    }
    if (!user && email) {
      user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    }

    if (user) {
      user.gitlabUsername = gitlabUsername;
      if (!user.name && name) {
        user.name = name;
      }
      return await this.userRepo.save(user);
    }

    const fallbackEmail = email ? email.toLowerCase() : `${gitlabUsername.toLowerCase()}@gitlab.repodoctor.local`;
    const newUser = this.userRepo.create({
      name: name || gitlabUsername,
      email: fallbackEmail,
      passwordHash: null,
      githubId: null,
      githubUsername: null,
      gitlabUsername,
    });

    return await this.userRepo.save(newUser);
  }

  /**
   * Links a GitLab account to an existing authenticated user.
   */
  async linkGitLabAccount(userId: string, gitlabUsername: string): Promise<UserSummaryDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.gitlabUsername = gitlabUsername;
    const saved = await this.userRepo.save(user);
    return this.mapToSummary(saved);
  }

  async findById(id: string): Promise<UserSummaryDto | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    return user ? this.mapToSummary(user) : null;
  }

  mapToSummary(user: UserEntity): UserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      githubUsername: user.githubUsername,
      gitlabUsername: user.gitlabUsername,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
