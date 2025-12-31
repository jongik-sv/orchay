/**
 * GET /api/config/basePath
 * 현재 기본 경로 및 초기화 상태 조회
 *
 * Task: 홈 디렉토리 선택 기능
 */

import { defineEventHandler } from 'h3';
import { pathManager } from '../../utils/pathManager';
import { checkOrchayStructure } from '../../utils/file';
import type { GetBasePathResponse } from '../../../types/appConfig';

/**
 * 현재 기본 경로 및 .orchay 구조 상태 반환
 */
export default defineEventHandler(async (): Promise<GetBasePathResponse> => {
  const structure = await checkOrchayStructure();

  // 모든 필수 디렉토리가 존재하면 초기화됨
  const initialized = structure.root && structure.settings && structure.projects;

  return {
    success: true,
    data: {
      basePath: pathManager.basePath,
      orchayRoot: pathManager.orchayRoot,
      initialized,
      structure,
    },
  };
});
