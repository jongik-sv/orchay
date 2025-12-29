/**
 * Attribute Validator
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 4.3
 *
 * Task 노드의 필수 속성 검증 모듈
 */

import type { WbsNode, TaskCategory, Priority } from '../../../../../types';
import type { ValidationError } from '../_types';
import { VALID_CATEGORIES, VALID_PRIORITIES } from '../../../../../types/validation';

// 필수 속성 목록
const REQUIRED_TASK_ATTRIBUTES = ['category', 'status', 'priority'] as const;

/**
 * category 값 유효성 검증
 *
 * @param category - 검증할 category 값
 * @returns 유효 여부
 */
export function validateCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category as TaskCategory);
}

/**
 * priority 값 유효성 검증
 *
 * @param priority - 검증할 priority 값
 * @returns 유효 여부
 */
export function validatePriority(priority: string): boolean {
  return VALID_PRIORITIES.includes(priority as Priority);
}

/**
 * Task 노드의 필수 속성 검증
 *
 * @param node - 검증할 WBS 노드
 * @returns 검증 오류 배열 (빈 배열이면 오류 없음)
 */
export function validateAttributes(node: WbsNode): ValidationError[] {
  const errors: ValidationError[] = [];

  // Task 타입이 아니면 검증 스킵 (WP, ACT는 필수 속성 없음)
  if (node.type !== 'task') {
    return errors;
  }

  // 필수 속성 검증
  for (const attr of REQUIRED_TASK_ATTRIBUTES) {
    const value = node[attr as keyof WbsNode] as string | undefined;

    // 누락 또는 빈 문자열 체크
    if (value === undefined || value === null || value === '') {
      errors.push({
        type: 'MISSING_ATTR',
        severity: 'error',
        nodeId: node.id,
        field: attr,
        message: `Missing required attribute '${attr}' for task '${node.id}'`,
      });
      continue;
    }

    // 값 유효성 검증
    if (attr === 'category' && !validateCategory(value)) {
      errors.push({
        type: 'INVALID_VALUE',
        severity: 'error',
        nodeId: node.id,
        field: 'category',
        message: `Invalid value for 'category' in node '${node.id}': '${value}'. Allowed values: ${VALID_CATEGORIES.join(', ')}`,
        expected: VALID_CATEGORIES.join(', '),
        actual: value,
      });
    }

    if (attr === 'priority' && !validatePriority(value)) {
      errors.push({
        type: 'INVALID_VALUE',
        severity: 'error',
        nodeId: node.id,
        field: 'priority',
        message: `Invalid value for 'priority' in node '${node.id}': '${value}'. Allowed values: ${VALID_PRIORITIES.join(', ')}`,
        expected: VALID_PRIORITIES.join(', '),
        actual: value,
      });
    }
  }

  return errors;
}
