/**
 * ID Validator
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 4.2
 *
 * ID 형식 검증 모듈
 */

import type { WbsNodeType } from '../../../../../types';
import type { ValidationError } from '../_types';

// ID 패턴 정규식 (모듈 레벨에서 컴파일하여 캐싱)
const WP_PATTERN = /^WP-\d{2}$/;
const ACT_PATTERN = /^ACT-\d{2}-\d{2}$/;
const TSK_3LEVEL_PATTERN = /^TSK-\d{2}-\d{2}$/;
const TSK_4LEVEL_PATTERN = /^TSK-\d{2}-\d{2}-\d{2}$/;

/**
 * 노드 타입별 정규식 패턴 반환
 *
 * @param type - 노드 타입 (wp, act, task)
 * @param depth - 프로젝트 깊이 (3 또는 4, task 타입에서만 사용)
 * @returns 해당 타입의 정규식 패턴 배열
 */
export function getPatterns(type: WbsNodeType, depth?: 3 | 4): RegExp[] {
  switch (type) {
    case 'wp':
      return [WP_PATTERN];
    case 'act':
      return [ACT_PATTERN];
    case 'task':
      if (depth === 3) return [TSK_3LEVEL_PATTERN];
      if (depth === 4) return [TSK_4LEVEL_PATTERN];
      // depth 미지정 시 둘 다 허용
      return [TSK_3LEVEL_PATTERN, TSK_4LEVEL_PATTERN];
    default:
      return [];
  }
}

/**
 * ID 형식 검증
 *
 * @param id - 검증할 ID
 * @param type - 노드 타입 (wp, act, task)
 * @param depth - 프로젝트 깊이 (3 또는 4, task 타입에서만 사용)
 * @returns 검증 오류 또는 null (유효한 경우)
 */
export function validateId(id: string, type: WbsNodeType, depth?: 3 | 4): ValidationError | null {
  // null/undefined/빈 문자열 체크
  if (!id || typeof id !== 'string') {
    return {
      type: 'ID_FORMAT',
      severity: 'error',
      nodeId: id || '',
      message: `Invalid ID format for ${type}: '${id}'. ID is required`,
    };
  }

  const patterns = getPatterns(type, depth);

  if (patterns.length === 0) {
    return {
      type: 'INVALID_VALUE',
      severity: 'error',
      nodeId: id,
      message: `Unknown node type: '${type}'`,
    };
  }

  // 패턴 중 하나라도 매칭되면 유효
  const isValid = patterns.some(pattern => pattern.test(id));

  if (!isValid) {
    const patternStr = patterns.map(p => p.source).join(' or ');
    return {
      type: 'ID_FORMAT',
      severity: 'error',
      nodeId: id,
      field: 'id',
      message: `Invalid ID format for ${type}: '${id}'. Expected pattern: ${patternStr}`,
      expected: patternStr,
      actual: id,
    };
  }

  return null;
}
