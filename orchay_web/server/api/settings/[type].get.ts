/**
 * 설정 조회 API 핸들러
 * Task: TSK-02-03-02
 * 상세설계: 020-detail-design.md 섹션 7.2, 7.3
 *
 * GET /api/settings/:type
 * - columns: 칸반 컬럼 설정
 * - categories: 카테고리 설정
 * - workflows: 워크플로우 설정
 * - actions: 액션 설정
 */

import { defineEventHandler, getRouterParam, createError, H3Event } from 'h3';
import type { SettingsFileType } from '../../../types/settings';
import { getSettingsByType, isValidSettingsType } from '../../utils/settings';

export default defineEventHandler(async (event: H3Event) => {
  const type = getRouterParam(event, 'type');

  // BR-004: 설정 타입 유효성 검사
  if (!type || !isValidSettingsType(type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'INVALID_SETTINGS_TYPE',
      message: `Invalid settings type: ${type}. Valid types are: columns, categories, workflows, actions`,
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  try {
    const settings = await getSettingsByType(type as SettingsFileType);
    return settings;
  } catch (error: unknown) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SETTINGS_LOAD_ERROR',
      message: `Failed to load settings: ${(error as Error).message}`,
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }
});
