import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
  Optional,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { GitHubOAuthService } from './github-oauth.service.js';
import { GitLabOAuthService } from './gitlab-oauth.service.js';
import { UsersService, CreateUserDto, UserSummaryDto } from './users.service.js';
import { SessionStore } from './session.store.js';
import { SessionGuard, AuthenticatedSessionRequest } from './session.guard.js';

function isSecureCookie(): boolean {
  return (
    process.env['COOKIE_SECURE'] === 'true' ||
    process.env['NODE_ENV'] === 'production'
  );
}

function getFrontendUrl(): string {
  return process.env['FRONTEND_URL'] || 'http://localhost:3000';
}

export interface LoginDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly oauthService: GitHubOAuthService,
    private readonly sessionStore: SessionStore,
    @Optional() @Inject(UsersService) private readonly usersService?: UsersService,
    @Optional() @Inject(GitLabOAuthService) private readonly gitlabOAuthService?: GitLabOAuthService,
  ) {}

  /**
   * Status check for frontend setup assistance — returns whether OAuth providers
   * are configured and the exact redirect URIs required in provider developer consoles.
   */
  @Get('config-status')
  getConfigStatus(): {
    githubConfigured: boolean;
    gitlabConfigured: boolean;
    githubCallbackUrl: string;
    gitlabCallbackUrl: string;
  } {
    return {
      githubConfigured: this.oauthService.isConfigured,
      gitlabConfigured: Boolean(this.gitlabOAuthService?.isConfigured),
      githubCallbackUrl: this.oauthService.redirectUri,
      gitlabCallbackUrl: this.gitlabOAuthService?.redirectUri || '',
    };
  }

  /**
   * Password-based user signup with local session creation and CSRF cookies.
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: CreateUserDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.usersService) {
      throw new BadRequestException('User service is unavailable');
    }

    const user = await this.usersService.createUser(dto);

    // Create session
    const session = this.sessionStore.create({
      userId: user.id,
      email: user.email,
      username: user.name,
      authProvider: 'local',
      githubUsername: user.githubUsername ?? undefined,
      gitlabUsername: user.gitlabUsername ?? undefined,
    });

    const secure = isSecureCookie();
    const maxAgeMs = this.sessionStore.maxAgeSeconds * 1000;

    res.cookie('session', session.id, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });

    res.cookie('csrf_token', session.csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });

    res.json({
      user,
      csrfToken: session.csrfToken,
    });
  }

  /**
   * Password-based user login.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async passwordLogin(
    @Body() dto: LoginDto,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.usersService) {
      throw new BadRequestException('User service is unavailable');
    }

    const user = await this.usersService.validateCredentials(dto.email, dto.password);

    const session = this.sessionStore.create({
      userId: user.id,
      email: user.email,
      username: user.name,
      authProvider: 'local',
      githubUsername: user.githubUsername ?? undefined,
      gitlabUsername: user.gitlabUsername ?? undefined,
    });

    const secure = isSecureCookie();
    const maxAgeMs = this.sessionStore.maxAgeSeconds * 1000;

    res.cookie('session', session.id, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });

    res.cookie('csrf_token', session.csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });

    res.json({
      user,
      csrfToken: session.csrfToken,
    });
  }

  /**
   * Initiates GitHub OAuth flow.
   * If not configured, redirects back to frontend with actionable query param
   * instead of stranding user on an unhandled 500 error page.
   */
  @Get('login')
  login(@Res() res: Response): void {
    const frontendUrl = getFrontendUrl();
    if (!this.oauthService.isConfigured) {
      this.logger.warn('GitHub OAuth attempted but credentials are not configured');
      res.redirect(`${frontendUrl}?auth_error=github_unconfigured`);
      return;
    }

    const state = this.oauthService.generateState();
    const secure = isSecureCookie();

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const authUrl = this.oauthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  /**
   * Handles GitHub OAuth callback.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: AuthenticatedSessionRequest,
    @Res() res: Response,
    @Query('error') error?: string,
  ): Promise<void> {
    const frontendUrl = getFrontendUrl();
    const cookieState = req.cookies?.oauth_state;

    // Always clear the temporary oauth_state cookie on both success and failure
    res.clearCookie('oauth_state', { path: '/auth' });

    if (error) {
      this.logger.warn(`GitHub OAuth cancelled or returned error: ${error}`);
      res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(error)}`);
      return;
    }

    // Validate state from query against both cookie and in-memory store (anti-replay)
    if (!state || !cookieState || state !== cookieState) {
      throw new BadRequestException('OAuth state mismatch or missing');
    }

    const isValid = this.oauthService.validateAndConsumeState(state);
    if (!isValid) {
      throw new BadRequestException('OAuth state expired or already used');
    }

    if (!code) {
      throw new BadRequestException('Missing authorization code from GitHub');
    }

    try {
      // Exchange code for token & fetch user identity
      const accessToken = await this.oauthService.exchangeCodeForToken(code);
      const githubUser = await this.oauthService.fetchGitHubUser(accessToken);

      let sessionUserId = githubUser.id.toString();
      let sessionEmail = githubUser.email || `${githubUser.login.toLowerCase()}@github.repodoctor.local`;
      let sessionName = githubUser.name || githubUser.login;

      // If usersService is present, link to current user or find/create in DB
      if (this.usersService) {
        const currentSessionId = req.cookies?.session;
        const existingSession = currentSessionId ? this.sessionStore.get(currentSessionId) : undefined;

        if (existingSession) {
          sessionUserId = existingSession.userId;
          const linked = await this.usersService.linkGitHubAccount(
            sessionUserId,
            githubUser.id.toString(),
            githubUser.login,
          );
          sessionEmail = linked.email;
          sessionName = linked.name;
          this.sessionStore.linkGitHub(existingSession.id, {
            githubUserId: githubUser.id,
            githubUsername: githubUser.login,
            githubAccessToken: accessToken,
          });

          // Existing session successfully linked — redirect to dashboard preserving session
          res.redirect(frontendUrl);
          return;
        } else {
          const dbUser = await this.usersService.findOrCreateGitHubUser(
            githubUser.id.toString(),
            githubUser.login,
            githubUser.name,
            githubUser.email,
          );
          sessionUserId = dbUser.id;
          sessionEmail = dbUser.email;
          sessionName = dbUser.name;
        }
      }

      // Create server-side session (opaque session ID)
      const session = this.sessionStore.create({
        userId: sessionUserId,
        email: sessionEmail,
        username: sessionName,
        authProvider: 'github',
        githubUserId: githubUser.id,
        githubUsername: githubUser.login,
        githubAccessToken: accessToken,
      });

      const secure = isSecureCookie();
      const maxAgeMs = this.sessionStore.maxAgeSeconds * 1000;

      // 1. Session Cookie (HttpOnly, opaque session ID)
      res.cookie('session', session.id, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: maxAgeMs,
      });

      // 2. CSRF Token Cookie (JavaScript-readable for double-submit header)
      res.cookie('csrf_token', session.csrfToken, {
        httpOnly: false,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: maxAgeMs,
      });

      res.redirect(frontendUrl);
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`GitHub OAuth processing error: ${err?.message || err}`);
      res.redirect(`${frontendUrl}?auth_error=oauth_failed`);
    }
  }

  /**
   * Initiates GitLab OAuth flow.
   */
  @Get('gitlab/login')
  gitlabLogin(@Res() res: Response): void {
    const frontendUrl = getFrontendUrl();
    if (!this.gitlabOAuthService || !this.gitlabOAuthService.isConfigured) {
      this.logger.warn('GitLab OAuth attempted but credentials are not configured');
      res.redirect(`${frontendUrl}?auth_error=gitlab_unconfigured`);
      return;
    }

    const state = this.gitlabOAuthService.generateState();
    const secure = isSecureCookie();

    res.cookie('gitlab_oauth_state', state, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/auth',
      maxAge: 10 * 60 * 1000,
    });

    const authUrl = this.gitlabOAuthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  }

  /**
   * Handles GitLab OAuth callback.
   */
  @Get('gitlab/callback')
  async gitlabCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: AuthenticatedSessionRequest,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = getFrontendUrl();
    const cookieState = req.cookies?.gitlab_oauth_state;

    res.clearCookie('gitlab_oauth_state', { path: '/auth' });

    if (error) {
      this.logger.warn(`GitLab OAuth error: ${error}`);
      res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!this.gitlabOAuthService) {
      res.redirect(`${frontendUrl}?auth_error=gitlab_unavailable`);
      return;
    }

    if (!state || !cookieState || state !== cookieState) {
      this.logger.warn('GitLab OAuth state mismatch');
      res.redirect(`${frontendUrl}?auth_error=state_mismatch`);
      return;
    }

    const isValid = this.gitlabOAuthService.validateAndConsumeState(state);
    if (!isValid) {
      res.redirect(`${frontendUrl}?auth_error=state_expired`);
      return;
    }

    if (!code) {
      res.redirect(`${frontendUrl}?auth_error=missing_code`);
      return;
    }

    try {
      const accessToken = await this.gitlabOAuthService.exchangeCodeForToken(code);
      const gitlabUser = await this.gitlabOAuthService.fetchGitLabUser(accessToken);

      const currentSessionId = req.cookies?.session;
      const existingSession = currentSessionId ? this.sessionStore.get(currentSessionId) : undefined;

      if (existingSession && this.usersService) {
        await this.usersService.linkGitLabAccount(existingSession.userId, gitlabUser.username);
        this.sessionStore.linkGitLab(existingSession.id, {
          gitlabUsername: gitlabUser.username,
          gitlabAccessToken: accessToken,
        });
        res.redirect(frontendUrl);
        return;
      }

      // If user is not already logged in, create or find GitLab user and start new session
      if (this.usersService) {
        const dbUser = await this.usersService.findOrCreateGitLabUser(
          gitlabUser.username,
          gitlabUser.name,
          gitlabUser.email,
        );

        const session = this.sessionStore.create({
          userId: dbUser.id,
          email: dbUser.email,
          username: dbUser.name,
          authProvider: 'local',
          gitlabUsername: gitlabUser.username,
          gitlabAccessToken: accessToken,
        });

        const secure = isSecureCookie();
        const maxAgeMs = this.sessionStore.maxAgeSeconds * 1000;

        res.cookie('session', session.id, {
          httpOnly: true,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: maxAgeMs,
        });

        res.cookie('csrf_token', session.csrfToken, {
          httpOnly: false,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: maxAgeMs,
        });
      }

      res.redirect(frontendUrl);
    } catch (err: any) {
      this.logger.error(`GitLab OAuth processing error: ${err?.message || err}`);
      res.redirect(`${frontendUrl}?auth_error=gitlab_oauth_failed`);
    }
  }

  @Get('me')
  @UseGuards(SessionGuard)
  getMe(@Req() req: AuthenticatedSessionRequest): {
    id: string;
    username: string;
    name?: string;
    email?: string;
    createdAt?: string;
    authProvider?: string;
    githubUsername?: string | null;
    gitlabUsername?: string | null;
  } {
    return {
      id: req.user.id,
      username: req.user.username,
      ...(req.user.name ? { name: req.user.name } : {}),
      ...(req.session?.email ? { email: req.session.email } : {}),
      ...(req.session?.createdAt ? { createdAt: new Date(req.session.createdAt).toISOString() } : {}),
      ...(req.session?.authProvider ? { authProvider: req.session.authProvider } : {}),
      ...(req.session?.githubUsername !== undefined ? { githubUsername: req.session.githubUsername } : {}),
      ...(req.session?.gitlabUsername !== undefined ? { gitlabUsername: req.session.gitlabUsername } : {}),
    };
  }

  @Get('profile')
  @UseGuards(SessionGuard)
  async getProfile(@Req() req: AuthenticatedSessionRequest): Promise<{
    id: string;
    name: string;
    email: string;
    createdAt?: string;
    githubUsername: string | null;
    gitlabUsername: string | null;
  }> {
    let dbUser: UserSummaryDto | null = null;
    if (this.usersService) {
      dbUser = await this.usersService.findById(req.user.id);
    }

    return {
      id: req.user.id,
      name: dbUser?.name || req.user.name || req.user.username,
      email: dbUser?.email || req.session?.email || '',
      createdAt: dbUser?.createdAt || (req.session?.createdAt ? new Date(req.session.createdAt).toISOString() : undefined),
      githubUsername: dbUser?.githubUsername ?? req.session?.githubUsername ?? null,
      gitlabUsername: dbUser?.gitlabUsername ?? req.session?.gitlabUsername ?? null,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: AuthenticatedSessionRequest, @Res() res: Response): void {
    const sessionId = req.cookies?.session;
    if (sessionId) {
      this.sessionStore.delete(sessionId);
    }

    const secure = isSecureCookie();
    res.clearCookie('session', { path: '/', httpOnly: true, secure, sameSite: 'lax' });
    res.clearCookie('csrf_token', { path: '/', httpOnly: false, secure, sameSite: 'lax' });

    res.json({ success: true });
  }
}
