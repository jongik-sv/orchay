/**
 * YAML WBS 파서
 * wbs.yaml 파일을 WbsNode[] 트리로 변환
 */

import { parse as parseYaml } from 'yaml';
import type { WbsNode, WbsMetadata } from '../../../../types';
import type { YamlWbsRoot } from './_types';
import { convertWorkPackages } from './_converter';

/**
 * 상태 코드에서 진행률 계산
 */
function getProgressFromStatus(status: string | undefined): number {
  if (!status) return 0;

  const statusMap: Record<string, number> = {
    '[ ]': 0,
    '[bd]': 20,
    '[dd]': 40,
    '[an]': 40,
    '[ds]': 40,
    '[ap]': 50,
    '[im]': 60,
    '[fx]': 70,
    '[vf]': 80,
    '[xx]': 100,
  };

  return statusMap[status] ?? 0;
}

/**
 * 진행률 자동 계산 (재귀)
 * Task는 상태에서 계산, WP/ACT는 자식 평균
 */
function calculateProgress(nodes: WbsNode[]): void {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      // 자식 먼저 계산
      calculateProgress(node.children);

      // 자식 Task들의 평균 진행률
      let totalProgress = 0;
      let taskCount = 0;

      const countTasks = (children: WbsNode[]) => {
        for (const child of children) {
          if (child.type === 'task') {
            totalProgress += child.progress ?? 0;
            taskCount++;
          } else if (child.children && child.children.length > 0) {
            countTasks(child.children);
          }
        }
      };

      countTasks(node.children);

      if (taskCount > 0) {
        node.progress = Math.round(totalProgress / taskCount);
        node.taskCount = taskCount;
      }
    } else if (node.type === 'task') {
      // Task 노드: 상태에서 진행률 계산
      node.progress = node.progress ?? getProgressFromStatus(node.status);
      node.taskCount = 1;
    }
  }
}

/**
 * YAML 문자열을 WbsNode[] 트리로 파싱
 *
 * @param yamlContent - wbs.yaml 파일 내용
 * @returns { metadata, tree }
 */
export function parseWbsYaml(yamlContent: string): {
  metadata: WbsMetadata;
  tree: WbsNode[];
} {
  // YAML 파싱
  const root = parseYaml(yamlContent) as YamlWbsRoot;

  // 메타데이터 추출
  const metadata: WbsMetadata = {
    version: String(root.wbs?.version ?? '1.0'),
    depth: root.wbs?.depth ?? 4,
    updated: root.project?.updatedAt ?? new Date().toISOString().split('T')[0],
    start: root.project?.scheduledStart ?? root.project?.createdAt ?? '',
  };

  // workPackages → WbsNode[] 변환
  const tree = convertWorkPackages(root.workPackages ?? []);

  // 진행률 자동 계산
  calculateProgress(tree);

  return { metadata, tree };
}

// 타입 및 유틸 함수 re-export
export type { YamlWbsRoot, YamlWorkPackage, YamlActivity, YamlTask } from './_types';
export { convertWorkPackages, convertTask, convertActivity } from './_converter';
