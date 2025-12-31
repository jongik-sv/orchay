/**
 * 앱 설정 타입 정의
 * Task: 홈 디렉토리 선택 기능
 *
 * Electron과 웹 환경 모두에서 사용되는 앱 설정 타입입니다.
 */

/**
 * 앱 설정 인터페이스
 */
export interface AppConfig {
  /** 설정 스키마 버전 */
  version: 1;
  /** 사용자가 선택한 .orchay 부모 경로 (절대 경로) */
  basePath: string;
  /** 최근 사용한 경로 목록 (최대 5개) */
  recentPaths?: string[];
  /** 마지막으로 열린 프로젝트 ID */
  lastOpenedProject?: string;
}

/**
 * 앱 설정 기본값
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  version: 1,
  basePath: '',
  recentPaths: [],
};

/**
 * 경로 검증 결과 인터페이스
 */
export interface PathValidationResult {
  /** 유효 여부 */
  valid: boolean;
  /** 에러 메시지 (유효하지 않을 경우) */
  error?: string;
}

/**
 * .orchay 존재 확인 결과 인터페이스
 */
export interface OrchayExistsResult {
  /** 디렉토리 존재 여부 */
  dirExists: boolean;
  /** .orchay 폴더 존재 여부 */
  orchayExists: boolean;
  /** 쓰기 권한 여부 */
  isWritable: boolean;
}

/**
 * 경로 설정 API 요청 바디
 */
export interface SetBasePathRequest {
  /** 새 기본 경로 (절대 경로) */
  basePath: string;
  /** .orchay가 없으면 생성할지 여부 */
  createIfMissing?: boolean;
}

/**
 * 경로 설정 API 응답
 */
export interface SetBasePathResponse {
  success: boolean;
  data: {
    previousPath: string;
    currentPath: string;
    message: string;
  };
}

/**
 * 경로 조회 API 응답
 */
export interface GetBasePathResponse {
  success: boolean;
  data: {
    basePath: string;
    orchayRoot: string;
    initialized: boolean;
    structure: {
      root: boolean;
      settings: boolean;
      projects: boolean;
      templates: boolean;
    };
  };
}
