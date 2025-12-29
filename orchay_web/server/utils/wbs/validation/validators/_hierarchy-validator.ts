/**
 * Hierarchy Validator
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 4.5
 *
 * 부모-자식 계층 관계 검증 모듈
 */

import type { WbsNode, WbsNodeType } from '../../../../../types';
import type { ValidationError } from '../_types';

/**
 * ID에서 접두사 추출
 *
 * @param id - 노드 ID
 * @param type - 노드 타입
 * @returns 접두사 문자열
 *
 * @example
 * extractPrefix('WP-05', 'wp') → '05'
 * extractPrefix('ACT-03-07', 'act') → '03-07'
 * extractPrefix('TSK-02-03-04', 'task') → '02-03' (4단계)
 * extractPrefix('TSK-01-02', 'task') → '01' (3단계)
 */
export function extractPrefix(id: string, type: WbsNodeType): string {
  if (!id) return '';

  const parts = id.split('-');

  switch (type) {
    case 'wp':
      // WP-01 → "01"
      return parts[1] || '';

    case 'act':
      // ACT-02-03 → "02-03"
      return parts.slice(1).join('-');

    case 'task':
      // TSK-01-02-03 (4단계) → "01-02"
      // TSK-01-02 (3단계) → "01"
      if (parts.length === 4) {
        // 4단계: TSK-XX-XX-XX → XX-XX
        return parts.slice(1, 3).join('-');
      } else if (parts.length === 3) {
        // 3단계: TSK-XX-XX → XX
        return parts[1] || '';
      }
      return '';

    default:
      return '';
  }
}

/**
 * 부모 ID로부터 자식의 기대 접두사 계산
 *
 * @param parentId - 부모 노드 ID
 * @param parentType - 부모 노드 타입
 * @returns 기대되는 접두사
 *
 * @example
 * getExpectedPrefix('WP-02', 'wp') → '02'
 * getExpectedPrefix('ACT-02-03', 'act') → '02-03'
 */
export function getExpectedPrefix(parentId: string, parentType: WbsNodeType): string {
  if (!parentId) return '';

  const parts = parentId.split('-');

  switch (parentType) {
    case 'wp':
      // WP-02 → 자식 ACT/TSK는 02로 시작해야 함
      return parts[1] || '';

    case 'act':
      // ACT-02-03 → 자식 TSK는 02-03으로 시작해야 함
      return parts.slice(1).join('-');

    default:
      return '';
  }
}

/**
 * 부모-자식 관계 검증
 *
 * @param node - 검증할 자식 노드
 * @param parent - 부모 노드 (null이면 루트 노드)
 * @returns 검증 오류 또는 null (유효한 경우)
 */
export function validateHierarchy(node: WbsNode, parent: WbsNode | null): ValidationError | null {
  // 부모가 없는 경우 (루트 노드)
  if (parent === null) {
    // WP는 루트 가능
    if (node.type === 'wp') {
      return null;
    }
    // Task/ACT는 부모 필요
    return {
      type: 'HIERARCHY_MISMATCH',
      severity: 'error',
      nodeId: node.id,
      message: `Task/ACT requires a parent: '${node.id}' cannot be a root node`,
    };
  }

  // 자식 노드의 접두사 추출
  const childPrefix = extractPrefix(node.id, node.type);
  // 부모로부터 기대되는 접두사 계산
  const expectedPrefix = getExpectedPrefix(parent.id, parent.type);

  // 접두사 비교
  // ACT 자식: 첫 번째 부분이 부모 WP와 일치해야 함
  // TSK 자식 (4단계): 두 부분이 부모 ACT와 일치해야 함
  // TSK 자식 (3단계): 첫 번째 부분이 부모 WP와 일치해야 함

  let isValid = false;

  if (parent.type === 'wp') {
    if (node.type === 'act') {
      // ACT-XX-YY의 첫 번째 부분(XX)이 WP-XX와 일치해야 함
      isValid = childPrefix.startsWith(expectedPrefix);
    } else if (node.type === 'task') {
      // 3단계 구조: TSK-XX-YY의 첫 번째 부분(XX)이 WP-XX와 일치해야 함
      isValid = childPrefix === expectedPrefix;
    }
  } else if (parent.type === 'act') {
    if (node.type === 'task') {
      // 4단계 구조: TSK-XX-YY-ZZ의 XX-YY가 ACT-XX-YY와 일치해야 함
      isValid = childPrefix === expectedPrefix;
    }
  }

  if (!isValid) {
    return {
      type: 'HIERARCHY_MISMATCH',
      severity: 'error',
      nodeId: node.id,
      message: `Hierarchy mismatch: '${node.id}' cannot be a child of '${parent.id}'. Expected prefix: ${expectedPrefix}, actual: ${childPrefix}`,
      expected: expectedPrefix,
      actual: childPrefix,
    };
  }

  return null;
}
