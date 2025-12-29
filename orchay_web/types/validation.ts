/**
 * WBS 유효성 검증 타입 정의
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 3
 */

/**
 * 오류 타입 열거형
 */
export type ErrorType =
  | 'ID_FORMAT'
  | 'MISSING_ATTR'
  | 'INVALID_STATUS'
  | 'DUPLICATE_ID'
  | 'HIERARCHY_MISMATCH'
  | 'INVALID_VALUE'
  | 'CIRCULAR_REFERENCE';

/**
 * 경고 타입 열거형
 */
export type WarningType =
  | 'MISSING_OPTIONAL'
  | 'DEPRECATED_VALUE';

/**
 * 검증 오류
 */
export interface ValidationError {
  type: ErrorType;
  severity: 'error' | 'warning';
  nodeId?: string;
  field?: string;
  message: string;
  expected?: string;
  actual?: string;
  line?: number;
}

/**
 * 검증 경고
 */
export interface ValidationWarning {
  type: WarningType;
  nodeId?: string;
  message: string;
  suggestion?: string;
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validatedAt: string;
  nodeCount: number;
}

/**
 * 검증 옵션
 */
export interface ValidationOptions {
  /** 첫 번째 오류 발견 시 즉시 반환 */
  failFast?: boolean;
  /** 프로젝트 깊이 (3 또는 4) - Task ID 검증에 사용 */
  depth?: 3 | 4;
}

/**
 * 유효한 상태 코드 상수
 * @deprecated Phase2: workflows.json 기반 런타임 조회로 전환. getValidStatusCodes() 사용 권장
 */
export const VALID_STATUS_CODES = ['[ ]', '[bd]', '[dd]', '[ap]', '[an]', '[ds]', '[im]', '[fx]', '[vf]', '[xx]'] as const;

/**
 * 상태 코드 타입
 */
export type StatusCode = typeof VALID_STATUS_CODES[number];

/**
 * 유효한 카테고리 상수
 */
export const VALID_CATEGORIES = ['development', 'defect', 'infrastructure'] as const;

/**
 * 유효한 우선순위 상수
 */
export const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
