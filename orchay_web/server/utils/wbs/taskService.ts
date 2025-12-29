/**
 * Task 서비스
 * Task: TSK-03-02
 * 상세설계: 020-detail-design.md 섹션 5.1
 *
 * Task 상세 정보 관리 비즈니스 로직
 */

import { join } from 'path';
import type {
  WbsNode,
  TaskDetail,
  TeamMember,
  DocumentInfo,
  TaskCategory,
  TaskStatus,
} from '../../../types';
import { getWbsTree, saveWbsTree } from './wbsService';
import {
  readJsonFile,
  writeJsonFile,
  listFiles,
  fileExists,
  getProjectPath,
  getTaskFolderPath,
  getTeamJsonPath,
  ensureDir,
} from '../file';
import { getProjectsList } from '../projects/projectsListService';
import {
  createNotFoundError,
  createBadRequestError,
  createInternalError,
} from '../errors/standardError';

/**
 * Task 업데이트 요청 인터페이스
 */
export interface TaskUpdateRequest {
  title?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assignee?: string;
  schedule?: {
    start: string;
    end: string;
  };
  tags?: string[];
  depends?: string[];
  ref?: string;
}

/**
 * Task 검색 결과 인터페이스
 */
interface TaskSearchResult {
  task: WbsNode;
  projectId: string;
  parentWp: string;
  parentAct?: string;
}

/**
 * 트리에서 Task ID로 노드 검색 (재귀)
 * @param nodes - WBS 노드 배열
 * @param taskId - 검색할 Task ID
 * @param parentWp - 부모 WP ID
 * @param parentAct - 부모 ACT ID (선택)
 * @returns Task 노드 또는 null
 */
export function findTaskInTree(
  nodes: WbsNode[],
  taskId: string,
  parentWp?: string,
  parentAct?: string
): { task: WbsNode; parentWp: string; parentAct?: string } | null {
  for (const node of nodes) {
    if (node.id === taskId && node.type === 'task') {
      return {
        task: node,
        parentWp: parentWp || '',
        parentAct,
      };
    }

    // WP 노드 기록
    const currentWp = node.type === 'wp' ? node.id : parentWp;
    // ACT 노드 기록
    const currentAct = node.type === 'act' ? node.id : parentAct;

    // 자식 노드 재귀 검색
    if (node.children && node.children.length > 0) {
      const found = findTaskInTree(node.children, taskId, currentWp, currentAct);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * 특정 프로젝트에서 Task 검색
 * @param projectId - 프로젝트 ID
 * @param taskId - 검색할 Task ID
 * @returns TaskSearchResult 또는 null
 */
export async function findTaskInProject(projectId: string, taskId: string): Promise<TaskSearchResult | null> {
  try {
    const { tree } = await getWbsTree(projectId);
    const result = findTaskInTree(tree, taskId);

    if (result) {
      return {
        task: result.task,
        projectId,
        parentWp: result.parentWp,
        parentAct: result.parentAct,
      };
    }
  } catch (error) {
    console.warn(`[TaskService] Failed to search task in project '${projectId}':`, error);
  }

  return null;
}

/**
 * 모든 프로젝트에서 Task 검색
 * @param taskId - 검색할 Task ID
 * @returns TaskSearchResult 또는 null
 */
export async function findTaskById(taskId: string): Promise<TaskSearchResult | null> {
  // 폴더 스캔 방식으로 프로젝트 목록 조회
  const projectsConfig = await getProjectsList();

  if (!projectsConfig.projects || projectsConfig.projects.length === 0) {
    return null;
  }

  // 각 프로젝트의 WBS에서 Task 검색
  for (const project of projectsConfig.projects) {
    try {
      const { tree } = await getWbsTree(project.id);
      const result = findTaskInTree(tree, taskId);

      if (result) {
        return {
          task: result.task,
          projectId: project.id,
          parentWp: result.parentWp,
          parentAct: result.parentAct,
        };
      }
    } catch (error) {
      // C-002: 에러 로깅 추가
      console.warn(`[TaskService] Failed to search task in project '${project.id}':`, error);
      continue;
    }
  }

  return null;
}

/**
 * 문서 목록 생성
 * @param projectId - 프로젝트 ID
 * @param taskId - Task ID
 * @returns DocumentInfo 배열
 *
 * FR-003: Task 문서 목록 조회
 */
async function buildDocumentInfoList(
  projectId: string,
  taskId: string
): Promise<DocumentInfo[]> {
  const taskFolderPath = getTaskFolderPath(projectId, taskId);
  const folderExists = await fileExists(taskFolderPath);

  if (!folderExists) {
    return [];
  }

  const files = await listFiles(taskFolderPath, '.md');
  const documents: DocumentInfo[] = [];

  // 문서 타입 매핑
  const typeMapping: Record<string, DocumentInfo['type']> = {
    '010-basic-design.md': 'design',
    '011-ui-design.md': 'design',
    '020-detail-design.md': 'design',
    '030-implementation.md': 'implementation',
    '070-integration-test.md': 'test',
    '080-manual.md': 'manual',
  };

  for (const file of files) {
    const type = typeMapping[file] || 'design';
    const filePath = join(taskFolderPath, file);
    const stat = await fileExists(filePath) ? await import('fs').then(fs => fs.promises.stat(filePath)) : null;

    documents.push({
      name: file,
      path: `tasks/${taskId}/${file}`,
      exists: true,
      type,
      stage: 'current',
      size: stat?.size,
      createdAt: stat?.birthtime.toISOString(),
      updatedAt: stat?.mtime.toISOString(),
    });
  }

  return documents;
}

/**
 * 가능한 워크플로우 액션 조회
 * @param category - Task 카테고리
 * @param status - 현재 상태
 * @returns 가능한 액션 배열
 *
 * TODO: TSK-03-03에서 workflows.json 기반으로 구현 예정
 * 현재는 하드코딩된 기본 액션 반환
 */
function getAvailableActions(category: TaskCategory, status: string): string[] {
  // 상태 코드 추출 (예: "detail-design [dd]" → "[dd]")
  const statusCode = status.match(/\[([^\]]+)\]/)?.[1] || status;

  const workflowMap: Record<TaskCategory, Record<string, string[]>> = {
    development: {
      '[ ]': ['start'],
      'bd': ['draft'],
      'dd': ['build'],
      'im': ['verify'],
      'vf': ['done'],
      'xx': [],
    },
    defect: {
      '[ ]': ['start'],
      'an': ['verify'],
      'fx': ['verify'],
      'vf': ['done'],
      'xx': [],
    },
    infrastructure: {
      '[ ]': ['start', 'skip'],
      'ds': ['build'],
      'im': ['done'],
      'xx': [],
    },
  };

  const categoryActions = workflowMap[category];
  if (!categoryActions) {
    return [];
  }

  return categoryActions[statusCode] || [];
}

/**
 * Task 상세 조회
 * @param taskId - Task ID
 * @param projectId - 프로젝트 ID (선택, 지정 시 해당 프로젝트에서만 검색)
 * @returns TaskDetail
 * @throws TASK_NOT_FOUND - Task 없음
 * @throws FILE_ACCESS_ERROR - 파일 읽기 실패
 *
 * FR-003: Task 상세 조회
 */
export async function getTaskDetail(taskId: string, projectId?: string): Promise<TaskDetail> {
  // Task 검색 (projectId가 지정되면 해당 프로젝트에서만 검색)
  const searchResult = projectId
    ? await findTaskInProject(projectId, taskId)
    : await findTaskById(taskId);
  if (!searchResult) {
    throw createNotFoundError(`Task를 찾을 수 없습니다: ${taskId}`);
  }

  const { task, projectId: foundProjectId, parentWp, parentAct } = searchResult;

  // 팀원 정보 조회
  const teamJsonPath = getTeamJsonPath(foundProjectId);
  const teamData = await readJsonFile<{ members: TeamMember[] }>(teamJsonPath);
  const assignee = teamData?.members?.find((m) => m.id === task.assignee) || null;

  // 문서 목록 조회
  const documents = await buildDocumentInfoList(foundProjectId, taskId);

  // 가능한 액션 조회
  const availableActions = getAvailableActions(
    task.category as TaskCategory,
    task.status || '[ ]'
  );

  return {
    id: task.id,
    title: task.title,
    category: task.category as TaskCategory,
    status: (task.status || '[ ]') as TaskStatus,
    priority: (task.priority || 'medium') as any,
    assignee: assignee || undefined,
    parentWp,
    parentAct,
    schedule: task.schedule,
    requirements: task.requirements || [],
    tags: task.tags || [],
    depends: task.depends || [],
    ref: task.ref,
    documents,
    availableActions,
    completed: task.completed,  // TSK-08-07: 단계별 완료 타임스탬프
  };
}

/**
 * Task 정보 수정
 * @param taskId - Task ID
 * @param updates - 수정할 속성
 * @param projectId - 프로젝트 ID (선택, 지정 시 해당 프로젝트에서만 검색)
 * @returns TaskDetail (수정 후)
 * @throws TASK_NOT_FOUND - Task 없음
 * @throws VALIDATION_ERROR - 유효성 검증 실패
 * @throws FILE_WRITE_ERROR - 파일 쓰기 실패
 *
 * FR-004: Task 정보 수정
 * BR-005: 이력 자동 기록
 */
export async function updateTask(
  taskId: string,
  updates: Partial<TaskUpdateRequest>,
  projectId?: string
): Promise<TaskDetail> {
  // Task 검색 (projectId가 지정되면 해당 프로젝트에서만 검색)
  const searchResult = projectId
    ? await findTaskInProject(projectId, taskId)
    : await findTaskById(taskId);
  if (!searchResult) {
    throw createNotFoundError(`Task를 찾을 수 없습니다: ${taskId}`);
  }

  const { task, projectId: foundProjectId } = searchResult;
  const resolvedProjectId = projectId ?? foundProjectId;

  // 유효성 검증
  if (updates.title && (updates.title.length < 1 || updates.title.length > 200)) {
    throw createBadRequestError(
      'VALIDATION_ERROR',
      '제목은 1-200자여야 합니다'
    );
  }

  if (updates.priority && !['critical', 'high', 'medium', 'low'].includes(updates.priority)) {
    throw createBadRequestError(
      'VALIDATION_ERROR',
      '유효하지 않은 우선순위입니다'
    );
  }

  if (updates.schedule) {
    const { start, end } = updates.schedule;
    if (new Date(end) < new Date(start)) {
      throw createBadRequestError(
        'VALIDATION_ERROR',
        '종료일은 시작일 이후여야 합니다'
      );
    }
  }

  // WBS 전체 조회
  const { metadata, tree } = await getWbsTree(resolvedProjectId);

  // 트리에서 Task 다시 찾기 (참조 업데이트용)
  const foundTask = findTaskInTree(tree, taskId);
  if (!foundTask) {
    throw createInternalError(
      'INTERNAL_ERROR',
      'Task를 다시 찾을 수 없습니다'
    );
  }

  // 속성 수정 (트리의 실제 노드 수정)
  if (updates.title !== undefined) foundTask.task.title = updates.title;
  if (updates.priority !== undefined) foundTask.task.priority = updates.priority;
  if (updates.assignee !== undefined) foundTask.task.assignee = updates.assignee;
  if (updates.schedule !== undefined) foundTask.task.schedule = updates.schedule;
  if (updates.tags !== undefined) foundTask.task.tags = updates.tags;
  if (updates.depends !== undefined) foundTask.task.depends = updates.depends;
  if (updates.ref !== undefined) foundTask.task.ref = updates.ref;

  // WBS 저장
  try {
    await saveWbsTree(resolvedProjectId, metadata, tree);
  } catch (error) {
    throw createInternalError(
      'FILE_WRITE_ERROR',
      `데이터 저장에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 수정된 Task 상세 정보 반환 (찾은 프로젝트 ID 사용)
  return getTaskDetail(taskId, resolvedProjectId);
}
