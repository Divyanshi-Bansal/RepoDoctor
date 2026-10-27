import { HttpException, HttpStatus } from '@nestjs/common';

export class RepositoryAccessDeniedException extends HttpException {
  constructor(repositoryId: string, userId: string) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        errorCode: 'ERR_REPOSITORY_ACCESS_DENIED',
        message: `User '${userId}' is not authorized to access repository '${repositoryId}'.`,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class RepositoryNotFoundException extends HttpException {
  constructor(repositoryId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'ERR_REPOSITORY_NOT_FOUND',
        message: `Repository '${repositoryId}' was not found.`,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class FeatureNodeNotFoundException extends HttpException {
  constructor(nodeId: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'ERR_FEATURE_NODE_NOT_FOUND',
        message: `Feature or system node '${nodeId}' was not found.`,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
