/**
 * 설정 캐시 관리 모듈
 * Task: TSK-02-03-02
 * 상세설계: 020-detail-design.md 섹션 5.2, 9
 *
 * 설정 파일의 메모리 캐싱을 담당합니다.
 * - 파일 없음(ENOENT): 기본값 사용 (BR-001)
 * - JSON 파싱 오류: 기본값 폴백 + 경고 로그 (BR-002)
 * - 서버 시작 시 1회 로드 후 캐싱 (BR-003)
 */

import { readFile } from 'fs/promises';
import type {
  Settings,
  SettingsFileType,
  ColumnsConfig,
  WorkflowsConfig,
} from '../../../types/settings';
import {
  DEFAULT_COLUMNS,
  DEFAULT_WORKFLOWS,
} from './defaults';
import { getSettingsFilePath } from './paths';
import { pathManager } from '../pathManager';

// ============================================================
// 경로 변경 리스너 등록
// ============================================================

/**
 * PathManager 경로 변경 시 캐시 자동 무효화
 * 홈 디렉토리가 변경되면 설정 파일도 다른 위치에서 로드해야 함
 */
pathManager.onPathChange(() => {
  console.log('[Settings] Path changed, invalidating cache');
  refreshCache();
});

// ============================================================
// 캐시 상태 관리
// ============================================================

interface CacheState {
  settings: Settings | null;
  isLoaded: boolean;
  loadedAt: Date | null;
}

/** 모듈 레벨 캐시 (싱글톤) */
let cache: CacheState = {
  settings: null,
  isLoaded: false,
  loadedAt: null,
};

// ============================================================
// 기본값 매핑
// ============================================================

const DEFAULTS: Record<SettingsFileType, ColumnsConfig | WorkflowsConfig> = {
  columns: DEFAULT_COLUMNS,
  workflows: DEFAULT_WORKFLOWS,
};

// ============================================================
// 파일 로드 함수
// ============================================================

/**
 * 단일 설정 파일 로드
 * BR-001: 파일 없으면 기본값 사용
 * BR-002: JSON 파싱 오류 시 기본값 폴백
 *
 * @param type 설정 파일 타입
 * @returns 로드된 설정 또는 기본값
 */
async function loadFromFile<T>(type: SettingsFileType): Promise<T> {
  const filePath = getSettingsFilePath(type);
  const defaultValue = DEFAULTS[type] as T;

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: unknown) {
    // BR-001: 파일 없음 - 기본값 사용 (로그 없음)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }

    // BR-002: JSON 파싱 오류 - 기본값 사용 + 경고 로그
    if (error instanceof SyntaxError) {
      console.warn(`[Settings] Failed to parse ${type}.json, using defaults: ${error.message}`);
      return defaultValue;
    }

    // 기타 오류 - 기본값 사용 + 경고 로그
    console.warn(`[Settings] Failed to load ${type}.json, using defaults: ${(error as Error).message}`);
    return defaultValue;
  }
}

/**
 * 전체 설정 파일 로드
 * @returns 전체 Settings 객체
 */
async function loadFromFiles(): Promise<Settings> {
  const [columns, workflows] = await Promise.all([
    loadFromFile<ColumnsConfig>('columns'),
    loadFromFile<WorkflowsConfig>('workflows'),
  ]);

  return {
    columns,
    workflows,
  };
}

// ============================================================
// 캐시 관리 함수
// ============================================================

/**
 * 캐시 유효성 확인
 * @returns 캐시가 유효하면 true
 */
export function isCacheValid(): boolean {
  return cache.isLoaded && cache.settings !== null;
}

/**
 * 캐시 무효화
 * BR-003: 다음 호출에서 재로드됨
 */
export function refreshCache(): void {
  cache = {
    settings: null,
    isLoaded: false,
    loadedAt: null,
  };
}

/**
 * 설정 로드 (캐시 사용)
 * BR-003: 서버 시작 시 1회 로드 후 캐싱
 * ISS-CR-002: 타입 안전성 개선 - non-null 단언 제거
 *
 * @returns 캐시된 또는 새로 로드된 Settings
 */
export async function loadSettings(): Promise<Settings> {
  // 캐시 적중: 이미 로드된 설정 반환
  // ISS-CR-002: 명시적 null 체크로 타입 안전성 확보
  if (isCacheValid() && cache.settings !== null) {
    return cache.settings;
  }

  // 파일에서 로드
  const settings = await loadFromFiles();

  // 캐시에 저장
  cache = {
    settings,
    isLoaded: true,
    loadedAt: new Date(),
  };

  return settings;
}

/**
 * 캐시 로드 시각 조회 (디버깅용)
 * @returns 로드 시각 또는 null
 */
export function getCacheLoadedAt(): Date | null {
  return cache.loadedAt;
}
