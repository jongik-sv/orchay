/**
 * Status Validator
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 4.4
 *
 * 상태 코드 유효성 검증 모듈
 */

import type { ValidationError } from '../_types';
import { VALID_STATUS_CODES } from '../_types';

/**
 * 상태 코드가 유효한지 확인
 *
 * @param status - 검증할 상태 코드
 * @returns 유효 여부
 */
export function isValidStatus(status: string): boolean {
  if (!status || typeof status !== 'string') {
    return false;
  }
  return VALID_STATUS_CODES.includes(status as any);
}

/**
 * 상태 코드 유효성 검증
 *
 * @param status - 검증할 상태 코드
 * @param nodeId - 노드 ID (오류 메시지용, 선택)
 * @returns 검증 오류 또는 null (유효한 경우)
 */
export function validateStatus(status: string, nodeId?: string): ValidationError | null {
  // null/undefined/빈 문자열 체크
  if (!status || typeof status !== 'string') {
    return {
      type: 'INVALID_STATUS',
      severity: 'error',
      nodeId,
      field: 'status',
      message: `Invalid status code '${status}'${nodeId ? ` for node '${nodeId}'` : ''}. Allowed codes: ${VALID_STATUS_CODES.join(', ')}`,
      expected: VALID_STATUS_CODES.join(', '),
      actual: String(status),
    };
  }

  if (!isValidStatus(status)) {
    return {
      type: 'INVALID_STATUS',
      severity: 'error',
      nodeId,
      field: 'status',
      message: `Invalid status code '${status}'${nodeId ? ` for node '${nodeId}'` : ''}. Allowed codes: ${VALID_STATUS_CODES.join(', ')}`,
      expected: VALID_STATUS_CODES.join(', '),
      actual: status,
    };
  }

  return null;
}
