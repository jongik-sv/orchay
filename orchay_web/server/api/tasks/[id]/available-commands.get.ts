/**
 * Task 가능한 명령어 조회 API
 * Task: TSK-03-04
 * 상세설계: 020-detail-design.md 섹션 6.1
 *
 * Query params:
 * - project: 프로젝트 ID (선택, 지정 시 해당 프로젝트에서만 검색)
 */

import { getAvailableCommands } from '../../../utils/workflow/transitionService';
import { findTaskById, findTaskInProject } from '../../../utils/wbs/taskService';
import { createNotFoundError } from '../../../utils/errors/standardError';

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id');

  if (!taskId) {
    throw createNotFoundError('Task ID가 필요합니다');
  }

  // projectId: 쿼리 파라미터로 받거나 undefined (전체 프로젝트 검색)
  const query = getQuery(event);
  const projectId = typeof query.project === 'string' ? query.project : undefined;

  // Task 존재 확인 (projectId가 지정되면 해당 프로젝트에서만 검색)
  const taskResult = projectId
    ? await findTaskInProject(projectId, taskId)
    : await findTaskById(taskId);
  if (!taskResult) {
    throw createNotFoundError(`Task를 찾을 수 없습니다: ${taskId}`);
  }

  const { task } = taskResult;

  // 가능한 명령어 조회
  const commands = await getAvailableCommands(taskId);

  // 현재 상태 코드 추출
  const statusCodeMatch = task.status?.match(/\[([^\]]+)\]/);
  const currentStatus = statusCodeMatch ? `[${statusCodeMatch[1]}]` : '[ ]';

  return {
    taskId,
    category: task.category,
    currentStatus,
    commands,
  };
});
