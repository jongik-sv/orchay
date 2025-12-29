/**
 * Task Selector 유틸리티
 *
 * 의존관계 분석하여 실행 가능한 Task 목록 반환
 * - Script: npx tsx .orchay/script/next-task.ts
 * - API: GET /api/wbs/executable-tasks
 */

import type { WbsNode, TaskCategory, Priority, WorkflowsConfig } from '../../../types';
import { getWorkflows } from '../settings';

// 실행 가능한 Task 정보
export interface ExecutableTask {
  id: string;
  title: string;
  category: TaskCategory;
  status: string;
  priority: Priority;
  nextAction: string;
}

// 대기 중인 Task 정보
export interface WaitingTask {
  id: string;
  title: string;
  blockedBy: string[];
}

// Task 선택 결과
export interface TaskSelectorResult {
  executable: ExecutableTask[];
  waiting: WaitingTask[];
}

// Task 선택 옵션
export interface TaskSelectorOptions {
  category?: TaskCategory;
  projectId?: string;
}

// 상태 코드 추출 정규식
const STATUS_CODE_REGEX = /\[([^\]]+)\]/;

/**
 * 상태 문자열에서 상태 코드 추출
 * 예: "detail-design [dd]" → "[dd]"
 *     "[xx]" → "[xx]"
 */
function extractStatusCode(status?: string): string {
  if (!status) return '[ ]';
  const match = status.match(STATUS_CODE_REGEX);
  return match ? `[${match[1]}]` : '[ ]';
}

/**
 * 우선순위 정렬 순서
 */
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * phase 우선순위 (낮을수록 먼저)
 */
const PHASE_ORDER: Record<string, number> = {
  todo: 0,
  design: 1,
  implement: 2,
  done: 99,
};

/**
 * 카테고리별 다음 액션 매핑
 */
const NEXT_ACTION_MAP: Record<TaskCategory, Record<string, string>> = {
  development: {
    '[ ]': 'start',
    '[bd]': 'draft',
    '[dd]': 'build',
    '[im]': 'verify',
    '[vf]': 'done',
    '[xx]': '-',
  },
  defect: {
    '[ ]': 'start',
    '[an]': 'fix',
    '[fx]': 'verify',
    '[vf]': 'done',
    '[xx]': '-',
  },
  infrastructure: {
    '[ ]': 'start',
    '[ds]': 'build',
    '[im]': 'done',
    '[xx]': '-',
  },
};

/**
 * 다음 실행 액션 결정
 */
function getNextAction(category: TaskCategory, statusCode: string): string {
  const categoryMap = NEXT_ACTION_MAP[category];
  if (!categoryMap) return 'start';
  return categoryMap[statusCode] || 'start';
}

/**
 * 상태 코드에서 phase 조회
 */
function getPhase(statusCode: string, workflows: WorkflowsConfig): string {
  const state = workflows.states[statusCode];
  return state?.phase || 'todo';
}

/**
 * 의존성 체크가 필요한지 확인 (implement phase만 체크)
 */
function shouldCheckDeps(statusCode: string, workflows: WorkflowsConfig): boolean {
  const phase = getPhase(statusCode, workflows);
  return phase === 'implement';
}

/**
 * 트리에서 모든 Task 추출 (재귀)
 */
function extractAllTasks(nodes: WbsNode[]): WbsNode[] {
  const tasks: WbsNode[] = [];

  function traverse(nodeList: WbsNode[]) {
    for (const node of nodeList) {
      if (node.type === 'task') {
        tasks.push(node);
      }
      if (node.children?.length) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return tasks;
}

/**
 * 의존성 검사
 * @returns true if all dependencies are completed ([xx])
 */
function checkDependencies(
  task: WbsNode,
  taskMap: Map<string, WbsNode>
): { satisfied: boolean; blockedBy: string[] } {
  if (!task.depends) {
    return { satisfied: true, blockedBy: [] };
  }

  // depends 필드는 쉼표로 구분된 Task ID 목록일 수 있음
  const dependIds = task.depends.split(',').map((id) => id.trim());
  const blockedBy: string[] = [];

  for (const depId of dependIds) {
    const depTask = taskMap.get(depId);
    if (!depTask) {
      // 의존 Task가 없으면 무시 (삭제되었거나 오타일 수 있음)
      continue;
    }

    const depStatus = extractStatusCode(depTask.status);
    if (depStatus !== '[xx]') {
      blockedBy.push(depId);
    }
  }

  return {
    satisfied: blockedBy.length === 0,
    blockedBy,
  };
}

/**
 * Task 정렬 (phase → 우선순위 → WBS ID)
 */
function sortTasks<T extends { priority?: Priority; id: string; status?: string }>(
  tasks: T[],
  workflows: WorkflowsConfig
): T[] {
  return tasks.sort((a, b) => {
    // 1. phase 우선 (todo/design이 implement보다 먼저)
    if (a.status && b.status) {
      const phaseA = PHASE_ORDER[getPhase(a.status, workflows)] ?? 2;
      const phaseB = PHASE_ORDER[getPhase(b.status, workflows)] ?? 2;
      if (phaseA !== phaseB) {
        return phaseA - phaseB;
      }
    }

    // 2. 우선순위
    const priorityA = PRIORITY_ORDER[a.priority || 'medium'] ?? 2;
    const priorityB = PRIORITY_ORDER[b.priority || 'medium'] ?? 2;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 3. WBS ID 순서
    return a.id.localeCompare(b.id);
  });
}

/**
 * 실행 가능한 Task 목록 조회
 *
 * @param tree - WBS 노드 트리
 * @param options - 필터 옵션
 * @returns { executable, waiting }
 */
export async function getExecutableTasks(
  tree: WbsNode[],
  options?: TaskSelectorOptions
): Promise<TaskSelectorResult> {
  const workflows = await getWorkflows();
  const allTasks = extractAllTasks(tree);

  // Task ID → Node 맵 생성
  const taskMap = new Map<string, WbsNode>();
  for (const task of allTasks) {
    taskMap.set(task.id, task);
  }

  const executable: ExecutableTask[] = [];
  const waiting: WaitingTask[] = [];

  for (const task of allTasks) {
    const statusCode = extractStatusCode(task.status);

    // 1. 완료된 Task 제외
    if (statusCode === '[xx]') {
      continue;
    }

    // 2. 카테고리 필터
    if (options?.category && task.category !== options.category) {
      continue;
    }

    // 3. phase 기반 의존성 체크 여부 결정
    const needsDepsCheck = shouldCheckDeps(statusCode, workflows);

    if (!needsDepsCheck) {
      // 의존성 체크 스킵 (todo/design 단계)
      executable.push({
        id: task.id,
        title: task.title,
        category: task.category || 'development',
        status: statusCode,
        priority: task.priority || 'medium',
        nextAction: getNextAction(task.category || 'development', statusCode),
      });
      continue;
    }

    // 4. 구현(implement) 단계: 의존성 검사
    const { satisfied, blockedBy } = checkDependencies(task, taskMap);

    if (satisfied) {
      executable.push({
        id: task.id,
        title: task.title,
        category: task.category || 'development',
        status: statusCode,
        priority: task.priority || 'medium',
        nextAction: getNextAction(task.category || 'development', statusCode),
      });
    } else {
      waiting.push({
        id: task.id,
        title: task.title,
        blockedBy,
      });
    }
  }

  // 정렬
  return {
    executable: sortTasks(executable, workflows),
    waiting: sortTasks(waiting.map((w) => ({
      ...w,
      priority: taskMap.get(w.id)?.priority,
    })), workflows).map(({ priority, ...rest }) => rest),
  };
}
