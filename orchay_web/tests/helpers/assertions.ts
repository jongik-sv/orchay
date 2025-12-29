import { expect } from 'vitest';
import type { WbsNode } from '../../types';

/**
 * WbsNode 구조 검증
 */
export function expectValidWbsNode(node: any): void {
  expect(node).toHaveProperty('id');
  expect(node).toHaveProperty('type');
  expect(node).toHaveProperty('title');
  expect(node).toHaveProperty('children');
  expect(Array.isArray(node.children)).toBe(true);
}

/**
 * 트리 구조 깊이 검증
 */
export function expectTreeDepth(
  nodes: WbsNode[],
  expectedDepth: number
): void {
  let maxDepth = 0;

  function traverse(node: WbsNode, depth: number) {
    maxDepth = Math.max(maxDepth, depth);
    node.children?.forEach(child => traverse(child, depth + 1));
  }

  nodes.forEach(node => traverse(node, 1));
  expect(maxDepth).toBe(expectedDepth);
}

/**
 * 상태 코드 유효성 검증
 */
export function expectValidStatus(status: string): void {
  const validStatuses = [
    '[ ]', '[bd]', '[dd]', '[an]', '[ds]',
    '[im]', '[fx]', '[vf]', '[ts]', '[xx]'
  ];
  expect(validStatuses).toContain(status);
}

/**
 * 카테고리 유효성 검증
 */
export function expectValidCategory(category: string): void {
  const validCategories = ['development', 'defect', 'infrastructure'];
  expect(validCategories).toContain(category);
}

/**
 * 우선순위 유효성 검증
 */
export function expectValidPriority(priority: string): void {
  const validPriorities = ['critical', 'high', 'medium', 'low'];
  expect(validPriorities).toContain(priority);
}
