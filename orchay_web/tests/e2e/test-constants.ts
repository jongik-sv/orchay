/**
 * E2E 테스트 상수 정의
 *
 * 모든 E2E 테스트에서 공유하는 상수를 정의합니다.
 * 테스트 프로젝트 ID 등을 통일하여 테스트 간 일관성을 유지합니다.
 */

import { join } from 'path';
import { tmpdir } from 'os';

// 테스트 프로젝트 정보
export const TEST_PROJECT_ID = 'e2e-test-project';
export const TEST_PROJECT_NAME = 'E2E 테스트 프로젝트';

// 임시 디렉토리 이름 (고정)
export const E2E_TEST_DIR_NAME = 'orchay-e2e-test';

/**
 * 테스트용 임시 디렉토리 경로 (고정)
 * Playwright의 실행 순서(config 로드 → globalSetup → webServer) 때문에
 * 동적으로 경로를 생성하면 전달이 어려워서 고정 경로 사용
 */
export const E2E_TEST_ROOT = join(tmpdir(), E2E_TEST_DIR_NAME);

/**
 * 임시 디렉토리가 테스트용인지 확인
 * @param path 확인할 경로
 * @returns 테스트용 임시 디렉토리이면 true
 */
export function isTestDirectory(path: string): boolean {
  return path.includes(E2E_TEST_DIR_NAME);
}
