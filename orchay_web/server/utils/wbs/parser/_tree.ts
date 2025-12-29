/**
 * WBS Parser - 트리 빌드 함수
 * Task: TSK-02-02-01
 * 상세설계: 020-detail-design.md 섹션 3.4
 */

import type { WbsNode } from '../../../../types';
import type { FlatNode } from './_types';

/**
 * 플랫 노드 배열을 트리 구조로 변환
 * @param flatNodes - 플랫 노드 배열
 * @returns 루트 노드 배열
 */
export function buildTree(flatNodes: FlatNode[]): WbsNode[] {
  const nodeMap = new Map<string, WbsNode>();
  const rootNodes: WbsNode[] = [];

  // 1단계: 모든 노드를 WbsNode로 변환하고 맵에 저장
  for (const node of flatNodes) {
    const wbsNode: WbsNode = {
      id: node.id,
      type: node.type,
      title: node.title,
      category: node.attributes.category,
      status: node.attributes.status,
      priority: node.attributes.priority,
      assignee: node.attributes.assignee,
      schedule: node.attributes.schedule,
      tags: node.attributes.tags,
      depends: node.attributes.depends,
      requirements: node.attributes.requirements,
      ref: node.attributes.ref,
      progress: 0,
      taskCount: 0,
      children: [],
      expanded: false,
      // TSK-03-05: 커스텀 속성 복사
      attributes: node.attributes.customAttributes,
      // TSK-03-06: 단계별 완료시각 복사
      completed: node.attributes.completed,
    };

    nodeMap.set(node.id, wbsNode);
  }

  // 2단계: 부모-자식 관계 설정
  for (const node of flatNodes) {
    const parentId = determineParentId(node);

    if (parentId === null) {
      // 루트 노드 (WP)
      rootNodes.push(nodeMap.get(node.id)!);
    } else {
      const parent = nodeMap.get(parentId);

      if (parent) {
        parent.children.push(nodeMap.get(node.id)!);
      } else {
        // 부모를 찾을 수 없음 (고아 노드)
        console.warn(`Orphan node: ${node.id}, missing parent: ${parentId}`);
        rootNodes.push(nodeMap.get(node.id)!);
      }
    }
  }

  return rootNodes;
}

/**
 * 노드의 부모 ID 결정
 * @param node - 플랫 노드
 * @returns 부모 ID (null이면 루트 노드)
 */
export function determineParentId(node: FlatNode): string | null {
  const idParts = node.id.split('-');

  if (idParts.length === 2) {
    // WP-XX: 루트 노드
    return null;
  }

  if (idParts.length === 3) {
    // TSK-XX-XX: 부모는 WP-XX
    return `WP-${idParts[1]}`;
  }

  if (idParts.length === 4 && idParts[0] === 'ACT') {
    // ACT-XX-XX: 부모는 WP-XX
    return `WP-${idParts[1]}`;
  }

  if (idParts.length === 4 && idParts[0] === 'TSK') {
    // TSK-XX-XX-XX: 부모는 ACT-XX-XX
    return `ACT-${idParts[1]}-${idParts[2]}`;
  }

  // 알 수 없는 형식
  return null;
}

/**
 * 트리 전체의 progress와 taskCount 계산
 * @param nodes - 루트 노드 배열
 */
export function calculateProgress(nodes: WbsNode[]): void {
  for (const node of nodes) {
    updateNodeMetrics(node);
  }
}

/**
 * 노드의 progress와 taskCount를 재귀적으로 계산
 * @param node - WBS 노드
 * @returns { progress, taskCount }
 */
function updateNodeMetrics(node: WbsNode): { progress: number; taskCount: number } {
  if (node.type === 'task') {
    // Task 노드: 상태에 따라 progress 계산
    let progress = 0;
    if (node.status === '[xx]') {
      progress = 100;
    } else if (node.status === '[vf]') {
      progress = 80;
    } else if (node.status === '[im]') {
      progress = 60;
    } else if (node.status === '[dd]') {
      progress = 40;
    } else if (node.status === '[bd]') {
      progress = 20;
    }

    node.progress = progress;
    node.taskCount = 1;

    return { progress, taskCount: 1 };
  }

  // WP 또는 ACT: 자식 노드의 평균 progress 계산
  let totalProgress = 0;
  let totalTasks = 0;

  for (const child of node.children) {
    const childMetrics = updateNodeMetrics(child);
    totalProgress += childMetrics.progress * childMetrics.taskCount;
    totalTasks += childMetrics.taskCount;
  }

  const avgProgress = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;

  node.progress = avgProgress;
  node.taskCount = totalTasks;

  return { progress: avgProgress, taskCount: totalTasks };
}
