/**
 * WBS Validation 내부 타입 정의
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 3
 */

// types/validation.ts에서 공용 타입 re-export
export type {
  ErrorType,
  WarningType,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  ValidationOptions,
  StatusCode,
} from '../../../../types/validation';

// Note: VALID_CATEGORIES, VALID_PRIORITIES는 parser/patterns.ts에서 정의
// Nuxt auto-import 중복 방지를 위해 VALID_STATUS_CODES만 re-export
export { VALID_STATUS_CODES } from '../../../../types/validation';
