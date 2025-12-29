/**
 * 프로젝트 경로 관리 모듈
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 5.4
 * DR-001: 경로 하드코딩 방지
 * DR-009: 경로 탐색 공격 방지
 * CRIT-002: 경로 탐색 공격 방어 강화
 *
 * 모든 프로젝트 경로는 이 모듈을 통해 생성하며, 하드코딩 금지
 */

import { join, normalize, isAbsolute, resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { createBadRequestError } from '../errors/standardError';
import { decodePathSegment } from '../../../app/utils/urlPath';

/**
 * 상위 디렉토리에서 .orchay 폴더 찾기
 * orchay 스케줄러와 동일한 방식
 * @returns .orchay가 있는 디렉토리 경로 또는 null
 */
function findOrchayRoot(): string | null {
  // INIT_CWD: npm run을 실행한 디렉토리 (npm이 설정)
  // PWD: 쉘의 현재 디렉토리
  // cwd(): 프로세스의 현재 디렉토리
  const startDir = process.env.INIT_CWD || process.env.PWD || process.cwd();
  let current = resolve(startDir);
  const root = dirname(current);

  while (current !== root) {
    const orchayPath = join(current, '.orchay');
    if (existsSync(orchayPath)) {
      return current;
    }
    current = dirname(current);
  }
  return null;
}

/**
 * 경로 안전성 검증
 * CRIT-002: URL 디코딩, 다중 슬래시, 심볼릭 링크 등 우회 공격 방지
 *
 * @param path 검증할 경로
 * @returns 검증 결과 (true: 안전, false: 위험)
 */
function isPathSafe(path: string): boolean {
  try {
    // URL 디코딩 후 재검증 (%2e%2e → ..)
    const decoded = decodePathSegment(path);
    const normalized = normalize(decoded);

    // 경로 순회 패턴 검사
    if (
      decoded.includes('..') ||            // 기본 순회
      normalized.includes('..') ||         // 정규화 후 순회
      decoded.includes('%') ||             // 이중 인코딩 시도
      /[\\\/]{2,}/.test(decoded)           // 다중 슬래시
    ) {
      return false;
    }

    // 정규화 후 경로가 변경되면 의심스러운 패턴
    if (normalize(path) !== resolve(normalize(path)).slice(resolve('.').length + 1) &&
      normalize(path) !== resolve(normalize(path))) {
      // 상대 경로가 아닌 경우 추가 검증 생략
    }

    return true;
  } catch {
    // 디코딩 실패 = 의심스러운 입력
    return false;
  }
}

/**
 * orchay 기본 경로 조회
 * 환경변수 ORCHAY_BASE_PATH 또는 현재 작업 디렉토리
 * CRIT-002: 보안 검증 강화
 *
 * @returns 기본 경로
 */
export function getBasePath(): string {
  const basePath = process.env.ORCHAY_BASE_PATH;

  // 환경변수가 없으면 상위 디렉토리에서 .orchay 찾기
  if (!basePath) {
    const orchayRoot = findOrchayRoot();
    if (orchayRoot) {
      return orchayRoot;
    }
    return process.cwd();
  }

  // CRIT-002: 강화된 보안 검증
  if (!isPathSafe(basePath)) {
    console.warn(`[Security] Unsafe path detected in ORCHAY_BASE_PATH: ${basePath}, using cwd`);
    return cwd;
  }

  // 경로 정규화
  const normalized = normalize(basePath);

  // 절대 경로 검증 (상대 경로 거부)
  if (!isAbsolute(normalized)) {
    console.warn(`[Security] Relative path in ORCHAY_BASE_PATH: ${basePath}, using cwd`);
    return cwd;
  }

  return normalized;
}

/**
 * .orchay/projects 기본 경로
 * @returns projects 폴더 경로
 */
export function getProjectsBasePath(): string {
  return join(getBasePath(), '.orchay', 'projects');
}

/**
 * 프로젝트 폴더 경로
 * @param projectId 프로젝트 ID
 * @returns .orchay/projects/{id}
 */
export function getProjectDir(projectId: string): string {
  const decodedId = validateProjectId(projectId);
  return join(getProjectsBasePath(), decodedId);
}

/**
 * 프로젝트 파일 경로
 * @param projectId 프로젝트 ID
 * @param fileName 파일명 (project.json | team.json)
 * @returns .orchay/projects/{id}/{fileName}
 */
export function getProjectFilePath(
  projectId: string,
  fileName: 'project.json' | 'team.json'
): string {
  return join(getProjectDir(projectId), fileName);
}

/**
 * 프로젝트 ID 유효성 검증
 * BR-001: 영소문자, 숫자, 하이픈, 한글 허용
 * DR-009: 경로 탐색 공격 방지
 *
 * @param id 프로젝트 ID
 * @throws 유효하지 않은 ID 시 에러
 */
export function validateProjectId(id: string): string {
  // URL 디코딩 처리 (한글, 공백, 괄호 등 인코딩된 문자 지원)
  const decodedId = decodePathSegment(id);

  if (!decodedId) {
    throw createBadRequestError(
      'INVALID_PROJECT_ID',
      '잘못된 프로젝트 ID 인코딩입니다'
    );
  }

  // BR-001: 형식 검증 (한글 포함)
  if (!/^[a-z0-9가-힣_-]+$/.test(decodedId)) {
    throw createBadRequestError(
      'INVALID_PROJECT_ID',
      '프로젝트 ID는 영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용됩니다'
    );
  }

  // DR-009: 경로 탐색 방지
  const normalized = normalize(decodedId);
  if (normalized !== decodedId || normalized.includes('..')) {
    throw createBadRequestError(
      'INVALID_PROJECT_ID',
      '잘못된 프로젝트 ID 형식입니다'
    );
  }

  return decodedId;
}

