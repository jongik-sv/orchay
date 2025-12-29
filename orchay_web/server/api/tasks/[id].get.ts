/**
 * GET /api/tasks/:id - Task 상세 조회
 * Task: TSK-03-02
 * FR-003
 *
 * Query params:
 * - project: 프로젝트 ID (선택, 지정 시 해당 프로젝트에서만 검색)
 */

import { getTaskDetail } from '../../utils/wbs/taskService';
import type { TaskDetail } from '../../../types';

export default defineEventHandler(async (event): Promise<TaskDetail> => {
  const taskId = getRouterParam(event, 'id') as string;
  const query = getQuery(event);
  const projectId = query.project as string | undefined;

  const task = await getTaskDetail(taskId, projectId);
  return task;
});
