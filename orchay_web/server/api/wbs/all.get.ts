/**
 * GET /api/wbs/all
 * Task: TSK-09-01
 * 상세설계: 020-detail-design.md 섹션 1.1
 *
 * 모든 프로젝트 WBS 조회 (다중 프로젝트 통합 뷰)
 */

import { defineEventHandler } from 'h3';
import type { AllWbsResponse } from '../../../types';
import { getAllProjectsWbs } from '../../utils/wbs/wbsService';
import { createInternalError } from '../../utils/errors/standardError';

export default defineEventHandler(async (): Promise<AllWbsResponse> => {
  try {
    const result = await getAllProjectsWbs();
    return result;
  } catch (error) {
    throw createInternalError(
      'WBS_FETCH_ERROR',
      `프로젝트 목록 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
