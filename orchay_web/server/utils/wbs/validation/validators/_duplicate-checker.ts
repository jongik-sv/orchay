/**
 * Duplicate Checker
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 4.6
 *
 * 중복 ID 검사 모듈
 */

import type { WbsNode } from '../../../../../types';
import type { ValidationError } from '../_types';

/**
 * 트리에서 모든 ID 수집 (재귀)
 *
 * @param nodes - WBS 노드 배열
 * @returns 모든 ID 배열
 */
export function collectAllIds(nodes: WbsNode[]): string[] {
  const ids: string[] = [];

  function traverse(nodeList: WbsNode[]): void {
    for (const node of nodeList) {
      ids.push(node.id);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return ids;
}

/**
 * 전체 트리에서 중복 ID 검사
 *
 * @param nodes - WBS 노드 배열
 * @returns 검증 오류 배열 (중복된 ID당 하나의 오류)
 *
 * 복잡도: O(n) - n은 노드 수
 */
export function checkDuplicates(nodes: WbsNode[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // 모든 ID 수집
  const ids = collectAllIds(nodes);

  // ID 출현 횟수 계산
  const idCounts = new Map<string, number>();
  for (const id of ids) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }

  // 중복된 ID에 대해 오류 생성
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push({
        type: 'DUPLICATE_ID',
        severity: 'error',
        nodeId: id,
        message: `Duplicate ID '${id}' found ${count} times in WBS tree`,
      });
    }
  }

  return errors;
}
