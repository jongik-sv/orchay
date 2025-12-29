/**
 * Playwright Global Teardown
 *
 * 테스트 완료 후 테스트 데이터를 정리합니다.
 * playwright.config.ts의 globalTeardown에서 호출됩니다.
 *
 * 주요 변경사항:
 * - 임시 디렉토리 전체 삭제
 * - 안전성 검증 (테스트 디렉토리인지 확인)
 */

import { rm } from 'fs/promises';
import { E2E_TEST_ROOT, isTestDirectory } from './test-constants';

async function globalTeardown() {
  console.log('[Global Teardown] Cleaning up E2E test environment...');

  // 안전성 검증: 테스트 디렉토리인지 확인
  if (!isTestDirectory(E2E_TEST_ROOT)) {
    console.error('[Global Teardown] SAFETY CHECK FAILED: Not a test directory:', E2E_TEST_ROOT);
    console.error('[Global Teardown] Aborting cleanup to prevent accidental data loss');
    return;
  }

  try {
    // 임시 디렉토리 전체 삭제
    await rm(E2E_TEST_ROOT, { recursive: true, force: true });
    console.log('[Global Teardown] Test directory cleaned up:', E2E_TEST_ROOT);
  } catch (error) {
    console.warn('[Global Teardown] Failed to clean up:', error);
  }
}

export default globalTeardown;
