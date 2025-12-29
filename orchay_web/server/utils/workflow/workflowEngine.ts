/**
 * 워크플로우 엔진
 * Task: TSK-03-04
 * 상세설계: 020-detail-design.md 섹션 5
 *
 * 고수준 워크플로우 오케스트레이션
 */

import { join } from 'path';
import type {
  WorkflowState,
  WorkflowHistory,
  TaskCategory,
  TransitionResult,
} from '../../../types';
import { findTaskById, findTaskInProject } from '../wbs/taskService';
import {
  executeTransition,
  getAvailableCommands as getCommandsFromTransitionService,
} from './transitionService';
import { statusCodeToName } from './stateMapper';
import { getWorkflows } from '../settings';
import { readJsonFile, writeJsonFile, getTaskFolderPath, ensureDir } from '../file';
import {
  createNotFoundError,
  createBadRequestError,
} from '../errors/standardError';

/**
 * 동시성 제어를 위한 히스토리 쓰기 락 맵
 * 동일 Task에 대한 동시 히스토리 쓰기를 순차 처리
 */
const historyLocks = new Map<string, Promise<void>>();

/**
 * queryHistory 반환 타입
 */
export interface QueryHistoryResult {
  items: WorkflowHistory[];
  totalCount: number;
}

/**
 * Task의 현재 워크플로우 상태 조회
 * @param taskId - Task ID
 * @returns WorkflowState
 * @throws TASK_NOT_FOUND - Task 없음
 *
 * FR-003: 워크플로우 상태 조회
 */
export async function getWorkflowState(
  taskId: string
): Promise<WorkflowState> {
  // Task 검색
  const taskResult = await findTaskById(taskId);
  if (!taskResult) {
    throw createNotFoundError(`Task를 찾을 수 없습니다: ${taskId}`);
  }

  const { task } = taskResult;
  const category = task.category as TaskCategory;

  // 상태 코드 추출
  const statusCodeMatch = task.status?.match(/\[([^\]]+)\]/);
  const currentState = statusCodeMatch ? statusCodeMatch[1] : '[ ]';

  // 상태명 조회
  const currentStateName = (await statusCodeToName(category, currentState)) || 'todo';

  // 워크플로우 정의 조회 (v2.0: Record 접근)
  const workflows = await getWorkflows();
  const workflow = workflows.workflows[category];

  if (!workflow) {
    throw createBadRequestError(
      'WORKFLOW_NOT_FOUND',
      `카테고리 '${category}'에 해당하는 워크플로우를 찾을 수 없습니다`
    );
  }

  // 가능한 명령어 조회 (TransitionService에 위임)
  const availableCommands = await getCommandsFromTransitionService(taskId);

  return {
    taskId,
    category,
    currentState,
    currentStateName,
    workflow: {
      id: category,  // v2.0: 카테고리가 워크플로우 ID
      name: workflow.name,
      states: workflow.states,
      transitions: workflow.transitions,
    },
    availableCommands,
  };
}

// Note: getAvailableCommands는 transitionService.ts에서 직접 auto-import

/**
 * 명령어 실행 및 상태 전이 (TransitionService 래핑)
 * @param taskId - Task ID
 * @param command - 실행할 명령어
 * @param comment - 변경 사유 (선택)
 * @returns TransitionResult
 *
 * FR-002: 상태 전이 실행
 */
export async function executeCommand(
  taskId: string,
  command: string,
  comment?: string
): Promise<TransitionResult> {
  // TransitionService에 위임
  const result = await executeTransition(taskId, command, comment);

  // 이력 기록
  await recordHistory(taskId, {
    taskId,
    timestamp: result.timestamp,
    action: 'transition',
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    command: result.command,
    comment,
  });

  return result;
}

/**
 * Task의 워크플로우 이력 조회
 * @param taskId - Task ID
 * @param filter - 필터링 옵션 (projectId 포함)
 * @returns QueryHistoryResult (items, totalCount)
 *
 * FR-004: 워크플로우 이력 조회
 */
export async function queryHistory(
  taskId: string,
  filter?: {
    action?: 'transition' | 'update';
    limit?: number;
    offset?: number;
    projectId?: string;
  }
): Promise<QueryHistoryResult> {
  // Task 존재 확인 (projectId가 지정되면 해당 프로젝트에서만 검색)
  const taskResult = filter?.projectId
    ? await findTaskInProject(filter.projectId, taskId)
    : await findTaskById(taskId);
  if (!taskResult) {
    throw createNotFoundError(`Task를 찾을 수 없습니다: ${taskId}`);
  }

  const { projectId } = taskResult;
  const historyPath = join(getTaskFolderPath(projectId, taskId), 'workflow-history.json');

  // 이력 파일 읽기
  const history = (await readJsonFile<WorkflowHistory[]>(historyPath)) || [];

  // 필터링
  let filtered = history;

  if (filter?.action) {
    filtered = filtered.filter((h) => h.action === filter.action);
  }

  // 전체 개수 저장 (페이징 전)
  const totalCount = filtered.length;

  // 페이징
  const offset = filter?.offset || 0;
  const limit = filter?.limit || filtered.length;

  return {
    items: filtered.slice(offset, offset + limit),
    totalCount,
  };
}

/**
 * 이력 기록 (내부 함수)
 * 동시성 제어: 동일 Task에 대한 동시 쓰기를 뮤텍스 패턴으로 순차 처리
 *
 * @param taskId - Task ID
 * @param entry - 이력 엔트리
 */
async function recordHistory(
  taskId: string,
  entry: WorkflowHistory
): Promise<void> {
  const taskResult = await findTaskById(taskId);
  if (!taskResult) {
    console.warn(`[WorkflowEngine] Task not found for history recording: ${taskId}`);
    return;
  }

  const { projectId } = taskResult;
  const lockKey = `${projectId}-${taskId}-history`;

  // 이전 작업 완료 대기 (동시성 제어)
  const previousLock = historyLocks.get(lockKey);
  if (previousLock) {
    await previousLock;
  }

  // 새 작업 시작 - 비동기 작업을 Promise로 래핑
  const operation = (async () => {
    const taskFolderPath = getTaskFolderPath(projectId, taskId);
    await ensureDir(taskFolderPath);

    const historyPath = join(taskFolderPath, 'workflow-history.json');

    // 기존 이력 읽기
    const history = (await readJsonFile<WorkflowHistory[]>(historyPath)) || [];

    // 최신 항목을 앞에 추가
    history.unshift(entry);

    // 최대 100개 유지
    if (history.length > 100) {
      history.splice(100);
    }

    // 저장
    await writeJsonFile(historyPath, history);
  })();

  // 락 등록
  historyLocks.set(lockKey, operation);

  try {
    await operation;
  } finally {
    // 작업 완료 후 락 제거
    historyLocks.delete(lockKey);
  }
}
