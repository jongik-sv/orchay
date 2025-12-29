import { defineEventHandler } from 'h3';
import { ensureOrchayStructure, checkOrchayStructure } from '../utils/file';

/**
 * POST /api/init
 * .orchay 디렉토리 구조 초기화 API
 *
 * 멱등성 보장: 이미 존재하는 폴더는 건너뜀
 */
export default defineEventHandler(async () => {
  // 현재 상태 확인
  const beforeStatus = await checkOrchayStructure();

  // 구조 생성
  const result = await ensureOrchayStructure();

  // 생성 후 상태 확인
  const afterStatus = await checkOrchayStructure();

  return {
    success: result.success,
    message: result.success
      ? 'ORCHAY structure initialized successfully'
      : 'ORCHAY structure initialization completed with errors',
    data: {
      created: result.created,
      errors: result.errors,
      status: {
        before: beforeStatus,
        after: afterStatus,
      },
    },
  };
});
