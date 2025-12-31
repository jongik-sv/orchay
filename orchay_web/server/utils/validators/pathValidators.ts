/**
 * 경로 검증 유틸리티
 * Task: 홈 디렉토리 선택 기능
 *
 * CRIT-002: 경로 순회 공격 방지를 위한 보안 검증
 */

import { normalize, isAbsolute, resolve } from 'path';
import { existsSync, statSync, accessSync, constants } from 'fs';
import { join } from 'path';
import type { PathValidationResult, OrchayExistsResult } from '../../../types/appConfig';

/**
 * 시스템 경로 블랙리스트 (접근 금지)
 */
const FORBIDDEN_PATHS = [
  // Unix 시스템 경로
  '/etc',
  '/var',
  '/usr',
  '/bin',
  '/sbin',
  '/root',
  '/boot',
  '/dev',
  '/proc',
  '/sys',
  // Windows 시스템 경로
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\System32',
  'C:\\ProgramData',
];

/**
 * 기본 경로 검증 (CRIT-002)
 *
 * @param path - 검증할 경로
 * @returns 검증 결과
 */
export function validateBasePath(path: string): PathValidationResult {
  // 빈 경로 검증
  if (!path || path.trim() === '') {
    return { valid: false, error: '경로를 입력해주세요' };
  }

  const trimmedPath = path.trim();

  // 절대 경로 검증
  if (!isAbsolute(trimmedPath)) {
    return { valid: false, error: '절대 경로를 입력해주세요 (예: C:\\projects 또는 /home/user/projects)' };
  }

  // 경로 순회 공격 방지 (..)
  if (trimmedPath.includes('..')) {
    return { valid: false, error: '경로에 상위 디렉토리 참조(..)를 사용할 수 없습니다' };
  }

  // 다중 슬래시 방지 (// 또는 \\)
  if (/[\\\/]{2,}/.test(trimmedPath)) {
    return { valid: false, error: '경로에 연속된 슬래시를 사용할 수 없습니다' };
  }

  // URL 인코딩된 경로 순회 방지
  try {
    const decoded = decodeURIComponent(trimmedPath);
    if (decoded.includes('..')) {
      return { valid: false, error: '인코딩된 경로 순회가 감지되었습니다' };
    }
    // 추가 URL 인코딩 시도 감지
    if (decoded !== trimmedPath && decoded.includes('%')) {
      return { valid: false, error: '이중 인코딩된 경로가 감지되었습니다' };
    }
  } catch {
    return { valid: false, error: '잘못된 경로 인코딩입니다' };
  }

  // 널 바이트 검증
  if (trimmedPath.includes('\0')) {
    return { valid: false, error: '경로에 널 문자를 사용할 수 없습니다' };
  }

  // 시스템 경로 차단
  const normalizedPath = normalize(trimmedPath).toLowerCase();
  for (const forbidden of FORBIDDEN_PATHS) {
    if (normalizedPath.startsWith(forbidden.toLowerCase())) {
      return { valid: false, error: '시스템 디렉토리에는 접근할 수 없습니다' };
    }
  }

  // 경로 길이 제한 (Windows MAX_PATH = 260)
  if (trimmedPath.length > 250) {
    return { valid: false, error: '경로가 너무 깁니다 (최대 250자)' };
  }

  return { valid: true };
}

/**
 * .orchay 존재 여부 및 접근 권한 확인
 *
 * @param basePath - 기본 경로
 * @returns 확인 결과
 */
export async function checkOrchayExists(basePath: string): Promise<OrchayExistsResult> {
  const result: OrchayExistsResult = {
    dirExists: false,
    orchayExists: false,
    isWritable: false,
  };

  try {
    // 디렉토리 존재 확인
    if (!existsSync(basePath)) {
      return result;
    }

    const stat = statSync(basePath);
    if (!stat.isDirectory()) {
      return result;
    }

    result.dirExists = true;

    // .orchay 폴더 존재 확인
    const orchayPath = join(basePath, '.orchay');
    if (existsSync(orchayPath)) {
      const orchayStat = statSync(orchayPath);
      result.orchayExists = orchayStat.isDirectory();
    }

    // 쓰기 권한 확인
    try {
      accessSync(basePath, constants.W_OK);
      result.isWritable = true;
    } catch {
      result.isWritable = false;
    }

    return result;
  } catch (error) {
    console.error('[PathValidator] Error checking path:', error);
    return result;
  }
}

/**
 * 경로 정규화 및 해결
 * 상대 경로를 절대 경로로 변환하고 정규화합니다.
 *
 * @param path - 입력 경로
 * @param baseDir - 기준 디렉토리 (기본: process.cwd())
 * @returns 정규화된 절대 경로
 */
export function normalizePath(path: string, baseDir?: string): string {
  const base = baseDir || process.cwd();
  return normalize(resolve(base, path));
}

/**
 * 안전한 경로 결합
 * 경로 순회 공격을 방지하면서 경로를 결합합니다.
 *
 * @param basePath - 기본 경로
 * @param subPath - 하위 경로
 * @returns 결합된 경로 또는 null (보안 위반 시)
 */
export function safeJoinPath(basePath: string, subPath: string): string | null {
  const normalized = normalize(join(basePath, subPath));
  const resolvedBase = resolve(basePath);
  const resolvedPath = resolve(normalized);

  // 결합된 경로가 기본 경로 내에 있는지 확인
  if (!resolvedPath.startsWith(resolvedBase)) {
    console.warn(`[Security] Path traversal attempt: ${subPath} escapes ${basePath}`);
    return null;
  }

  return normalized;
}
