import { defineEventHandler } from 'h3';
import { checkOrchayStructure } from '../utils/file';

/**
 * GET /api/init
 * .orchay 디렉토리 구조 상태 확인 API
 */
export default defineEventHandler(async () => {
  const status = await checkOrchayStructure();

  const allExists = status.root && status.settings && status.templates && status.projects;

  return {
    success: true,
    data: {
      initialized: allExists,
      status,
    },
  };
});
