import { BadRequestException } from '@nestjs/common';

export class FeatureQueryDto {
  readonly question: string;

  constructor(partial: Partial<FeatureQueryDto>) {
    if (!partial.question || typeof partial.question !== 'string' || partial.question.trim().length === 0) {
      throw new BadRequestException('Question is required and must be a non-empty string.');
    }
    this.question = partial.question.trim();
  }
}
