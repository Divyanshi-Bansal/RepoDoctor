import { describe, it, expect } from 'vitest';
import { REPO_DOCTOR_VERSION } from '../src/index.js';

describe('shared package', () => {
  it('exports REPO_DOCTOR_VERSION', () => {
    expect(REPO_DOCTOR_VERSION).toBe('0.1.0');
  });
});
