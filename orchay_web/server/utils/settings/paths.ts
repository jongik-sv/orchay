/**
 * 설정 경로 관리 모듈
 * Task: TSK-02-03-02
 * 상세설계: 020-detail-design.md 섹션 5.1.1
 *
 * 환경 설정 기반 경로 관리로 하드코딩 방지
 * ISS-CR-003: 경로 주입 취약점 방지를 위한 검증 추가
 */

import { join, resolve, normalize } from 'path';
import type { SettingsFileType } from '../../../types/settings';
import { SETTINGS_FILE_NAMES } from '../../../types/settings';

/**
 * orchay 기본 경로 조회
 * ISS-CR-003: 경로 검증 및 정규화 추가
 * @returns 검증된 기본 경로 또는 현재 작업 디렉토리
 */
export function getSettingsBasePath(): string {
  const basePath = process.env.ORCHAY_BASE_PATH;
  const cwd = process.cwd();

  // 환경변수가 설정되지 않은 경우 기본값 사용
  if (!basePath) {
    return cwd;
  }

  // 경로 정규화 및 절대 경로 변환
  const normalized = normalize(resolve(basePath));

  // 보안 검증: 경로 순회 공격 방지
  // 상위 디렉토리 참조(../) 포함 여부 확인
  if (basePath.includes('..')) {
    console.warn(`[Security] Path traversal detected in ORCHAY_BASE_PATH: ${basePath}, using cwd`);
    return cwd;
  }

  return normalized;
}

/**
 * settings 디렉토리 경로 조회
 * @returns .orchay/settings 전체 경로
 */
export function getSettingsDir(): string {
  return join(getSettingsBasePath(), '.orchay', 'settings');
}

/**
 * 설정 파일 전체 경로 조회
 * @param type 설정 파일 타입
 * @returns 설정 파일의 전체 경로
 */
export function getSettingsFilePath(type: SettingsFileType): string {
  return join(getSettingsDir(), SETTINGS_FILE_NAMES[type]);
}
