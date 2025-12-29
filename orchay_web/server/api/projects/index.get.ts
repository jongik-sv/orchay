/**
 * GET /api/projects - 프로젝트 목록 조회
 * Task: TSK-02-03-03
 * FR-001
 */

import { getProjectsList } from '../../utils/projects/projectsListService';
import type { ProjectListResponse } from '../../utils/projects/types';

export default defineEventHandler(async (event): Promise<ProjectListResponse> => {
  const query = getQuery(event);
  const statusFilter = query.status as 'active' | 'archived' | undefined;

  const config = await getProjectsList(statusFilter);

  return {
    projects: config.projects,
    defaultProject: config.defaultProject || null,
    total: config.projects.length,
  };
});
