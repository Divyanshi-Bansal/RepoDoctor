import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url?: string;
}

export interface IngestionResult {
  readonly commitSha: string;
  readonly workspaceDir: string;
  readonly relativeFiles: readonly string[];
  readonly totalBytes: number;
}

export const INGESTION_LIMITS = {
  MAX_FILES: 100,
  MAX_FILE_SIZE_BYTES: 1 * 1024 * 1024, // 1 MB
  MAX_TOTAL_BYTES: 10 * 1024 * 1024, // 10 MB
  TIMEOUT_MS: 30000, // 30 seconds
};

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const IGNORED_PATH_SEGMENTS = [
  'node_modules',
  '.git',
  'dist',
  '.next',
  'build',
  'coverage',
];

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  /**
   * Validates that a repository relative path is safe:
   * - Cannot be absolute
   * - Cannot escape root via '..'
   * - Cannot contain null bytes
   */
  isSafeRelativePath(relPath: string): boolean {
    if (!relPath || typeof relPath !== 'string') return false;
    if (relPath.startsWith('/') || relPath.startsWith('\\')) return false;
    if (relPath.includes('\0')) return false;

    const normalized = path.normalize(relPath);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      return false;
    }
    return true;
  }

  isSupportedSourceFile(filePath: string): boolean {
    if (!this.isSafeRelativePath(filePath)) return false;
    if (filePath.endsWith('.d.ts')) return false;

    // Ignore build / vendor directories
    const segments = filePath.split(/[/\\]/);
    if (segments.some((seg) => IGNORED_PATH_SEGMENTS.includes(seg))) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  /**
   * Verifies that the user has read access to the target repository.
   */
  async verifyRepositoryAccess(
    owner: string,
    repo: string,
    accessToken: string,
  ): Promise<{ defaultBranch: string }> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'RepoDoctor-Ingestion',
      },
    });

    if (response.status === 401) {
      throw new UnauthorizedException('GitHub authorization token is expired or invalid');
    }
    if (response.status === 403 || response.status === 404) {
      throw new ForbiddenException(`You are not authorized to access ${owner}/${repo}`);
    }
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to verify repository access (GitHub HTTP ${response.status})`,
      );
    }

    const data = (await response.json()) as { default_branch?: string };
    return {
      defaultBranch: data.default_branch || 'main',
    };
  }

  /**
   * Safely retrieves repository file tree and downloads supported JS/TS files
   * into an isolated temporary workspace directory.
   */
  async fetchRepositoryFiles(
    owner: string,
    repo: string,
    accessToken: string,
  ): Promise<IngestionResult> {
    const { defaultBranch } = await this.verifyRepositoryAccess(owner, repo, accessToken);

    // Fetch recursive tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const treeRes = await fetch(treeUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'RepoDoctor-Ingestion',
      },
      signal: AbortSignal.timeout(INGESTION_LIMITS.TIMEOUT_MS),
    });

    if (!treeRes.ok) {
      throw new InternalServerErrorException(
        `Failed to fetch Git tree for ${owner}/${repo} (HTTP ${treeRes.status})`,
      );
    }

    const treeData = (await treeRes.json()) as {
      sha: string;
      tree: GitHubTreeItem[];
      truncated?: boolean;
    };

    const commitSha = treeData.sha || 'unknown';
    const allItems = treeData.tree || [];

    // Filter candidate files based on security, extension, and limits
    const candidates: GitHubTreeItem[] = [];
    for (const item of allItems) {
      if (item.type !== 'blob') continue;
      if (!this.isSafeRelativePath(item.path)) {
        this.logger.warn(`Skipping unsafe path: ${item.path}`);
        continue;
      }
      if (!this.isSupportedSourceFile(item.path)) continue;

      // File size limits check
      if (item.size && item.size > INGESTION_LIMITS.MAX_FILE_SIZE_BYTES) {
        this.logger.warn(
          `Skipping oversized file: ${item.path} (${item.size} bytes > 1MB limit)`,
        );
        continue;
      }

      candidates.push(item);
      if (candidates.length >= INGESTION_LIMITS.MAX_FILES) {
        this.logger.warn(
          `Reached maximum file limit of ${INGESTION_LIMITS.MAX_FILES} files for ${owner}/${repo}`,
        );
        break;
      }
    }

    // Create unique temporary workspace
    const workspaceDir = path.join(os.tmpdir(), 'repodoctor-workspaces', randomUUID());
    await fs.promises.mkdir(workspaceDir, { recursive: true });

    let totalBytes = 0;
    const downloadedFiles: string[] = [];

    try {
      for (const item of candidates) {
        if (totalBytes >= INGESTION_LIMITS.MAX_TOTAL_BYTES) {
          this.logger.warn(`Reached total byte download limit (${INGESTION_LIMITS.MAX_TOTAL_BYTES} bytes).`);
          break;
        }

        const rawFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${commitSha}`;
        const fileRes = await fetch(rawFileUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3.raw',
            'User-Agent': 'RepoDoctor-Ingestion',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!fileRes.ok) {
          this.logger.warn(`Failed to download ${item.path} (HTTP ${fileRes.status})`);
          continue;
        }

        const content = await fileRes.text();
        const contentBytes = Buffer.byteLength(content, 'utf8');

        if (contentBytes > INGESTION_LIMITS.MAX_FILE_SIZE_BYTES) {
          this.logger.warn(`Skipping downloaded file ${item.path} exceeding size limit.`);
          continue;
        }

        const destination = path.join(workspaceDir, item.path);

        // Security check: ensure target destination is strictly inside workspaceDir
        const resolvedDest = path.resolve(destination);
        if (!resolvedDest.startsWith(path.resolve(workspaceDir) + path.sep)) {
          throw new BadRequestException(`Path traversal violation detected: ${item.path}`);
        }

        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        await fs.promises.writeFile(destination, content, 'utf8');

        downloadedFiles.push(item.path);
        totalBytes += contentBytes;
      }

      return {
        commitSha,
        workspaceDir,
        relativeFiles: downloadedFiles,
        totalBytes,
      };
    } catch (err) {
      // Clean up workspace on error
      await this.cleanupWorkspace(workspaceDir);
      throw err;
    }
  }

  /**
   * Guaranteed cleanup of temporary workspace directory.
   */
  async cleanupWorkspace(workspaceDir: string): Promise<void> {
    try {
      if (workspaceDir && fs.existsSync(workspaceDir)) {
        await fs.promises.rm(workspaceDir, { recursive: true, force: true });
      }
    } catch (err) {
      this.logger.error(`Failed to clean workspace directory ${workspaceDir}: ${err}`);
    }
  }
}
