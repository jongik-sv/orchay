/**
 * PUT /api/tasks/:id - Task 정보 수정
 * Task: TSK-03-02
 * FR-004
 */

import { updateTask } from '../../utils/wbs/taskService';
import type { TaskDetail } from '../../../types';
import type { TaskUpdateRequest } from '../../utils/wbs/taskService';

export default defineEventHandler(async (event): Promise<{
  success: boolean;
  task: TaskDetail;
}> => {
  const taskId = getRouterParam(event, 'id') as string;
  const updates = await readBody<Partial<TaskUpdateRequest>>(event);

  // projectId: 쿼리 파라미터로 받거나 undefined (전체 프로젝트 검색)
  const query = getQuery(event);
  const projectId = typeof query.project === 'string' ? query.project : undefined;

  const task = await updateTask(taskId, updates, projectId);
  return {
    success: true,
    task,
  };
});
