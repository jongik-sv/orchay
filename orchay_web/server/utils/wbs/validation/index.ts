/**
 * WBS Validator - 메인 모듈
 * Task: TSK-02-02-03
 * 상세설계: 020-detail-design.md 섹션 4.1
 *
 * WBS 데이터 유효성 검증 서비스
 */

import type { WbsNode } from '../../../../types';
import type { ValidationResult, ValidationError, ValidationOptions } from './_types';
import { validateId } from './validators/_id-validator';
import { validateAttributes } from './validators/_attribute-validator';
import { validateStatus, isValidStatus } from './validators/_status-validator';
import { validateHierarchy, extractPrefix, getExpectedPrefix } from './validators/_hierarchy-validator';
import { checkDuplicates, collectAllIds } from './validators/_duplicate-checker';

// Note: For testing, import directly from submodules:
// - validateId from './validators/_id-validator'
// - validateAttributes from './validators/_attribute-validator'
// - validateStatus, isValidStatus from './validators/_status-validator'
// - validateHierarchy, extractPrefix, getExpectedPrefix from './validators/_hierarchy-validator'
// - checkDuplicates, collectAllIds from './validators/_duplicate-checker'
// - ValidationResult, ValidationError, ValidationOptions types from './_types'

/**
 * 단일 노드 검증
 *
 * @param node - 검증할 노드
 * @param parent - 부모 노드 (null이면 루트)
 * @param options - 검증 옵션
 * @returns 검증 오류 배열
 */
function validateNode(
  node: WbsNode,
  parent: WbsNode | null,
  options?: ValidationOptions
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. ID 형식 검증
  const idError = validateId(node.id, node.type, options?.depth);
  if (idError) {
    errors.push(idError);
  }

  // 2. Task의 경우 속성 검증
  if (node.type === 'task') {
    const attrErrors = validateAttributes(node);
    errors.push(...attrErrors);

    // 3. 상태 코드 검증 (status가 있을 때만)
    if (node.status) {
      const statusError = validateStatus(node.status, node.id);
      if (statusError) {
        errors.push(statusError);
      }
    }
  }

  // 4. 계층 관계 검증
  const hierarchyError = validateHierarchy(node, parent);
  if (hierarchyError) {
    errors.push(hierarchyError);
  }

  return errors;
}

/**
 * 재귀적으로 오류 수집
 *
 * @param nodes - 노드 배열
 * @param parent - 부모 노드
 * @param errors - 오류 수집 배열
 * @param nodeCount - 노드 카운트 객체
 * @param options - 검증 옵션
 * @param visited - 순환 참조 검출용 Set
 * @returns 조기 종료 여부
 */
function collectErrors(
  nodes: WbsNode[],
  parent: WbsNode | null,
  errors: ValidationError[],
  nodeCount: { count: number },
  options?: ValidationOptions,
  visited: Set<string> = new Set()
): boolean {
  for (const node of nodes) {
    // 순환 참조 검출
    if (visited.has(node.id)) {
      errors.push({
        type: 'CIRCULAR_REFERENCE',
        severity: 'error',
        nodeId: node.id,
        message: `Circular reference detected: '${node.id}'`,
      });
      continue;
    }

    visited.add(node.id);
    nodeCount.count++;

    // 노드 검증
    const nodeErrors = validateNode(node, parent, options);
    errors.push(...nodeErrors);

    // failFast 옵션: 첫 번째 오류 발견 시 즉시 반환
    if (options?.failFast && errors.length > 0) {
      return true;
    }

    // 자식 노드 재귀 검증
    if (node.children && node.children.length > 0) {
      const shouldStop = collectErrors(
        node.children,
        node,
        errors,
        nodeCount,
        options,
        visited
      );
      if (shouldStop) {
        return true;
      }
    }

    visited.delete(node.id); // 백트래킹
  }

  return false;
}

/**
 * 전체 WBS 트리 검증
 *
 * @param nodes - WBS 노드 배열
 * @param options - 검증 옵션
 * @returns 검증 결과
 *
 * @example
 * const result = validateWbs(nodes);
 * if (!result.isValid) {
 *   console.log('Errors:', result.errors);
 * }
 */
export function validateWbs(
  nodes: WbsNode[],
  options?: ValidationOptions
): ValidationResult {
  const errors: ValidationError[] = [];
  const nodeCount = { count: 0 };
  const validatedAt = new Date().toISOString();

  // 빈 트리는 유효함
  if (!nodes || nodes.length === 0) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validatedAt,
      nodeCount: 0,
    };
  }

  // 1. 중복 ID 검사 (전체 트리에서 먼저 수행)
  const duplicateErrors = checkDuplicates(nodes);
  errors.push(...duplicateErrors);

  // failFast 옵션 체크
  if (options?.failFast && errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings: [],
      validatedAt,
      nodeCount: 0,
    };
  }

  // 2. 재귀적으로 각 노드 검증
  collectErrors(nodes, null, errors, nodeCount, options);

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [], // 현재는 경고 미사용
    validatedAt,
    nodeCount: nodeCount.count,
  };
}
