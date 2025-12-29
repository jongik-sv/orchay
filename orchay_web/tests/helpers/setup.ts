import { beforeAll, afterAll, beforeEach } from 'vitest';
import { SUPPRESSED_WARNINGS, SUPPRESSED_ERRORS } from './constants';

// Pinia Mock Setup
beforeEach(() => {
  // Pinia 초기화는 각 테스트에서 수행
});

// Console 경고 무시 (테스트 노이즈 제거)
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args: any[]) => {
    const msg = args[0];
    if (
      typeof msg === 'string' &&
      SUPPRESSED_WARNINGS.some(pattern => msg.includes(pattern))
    ) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    const msg = args[0];
    if (
      typeof msg === 'string' &&
      SUPPRESSED_ERRORS.some(pattern => msg.includes(pattern))
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
