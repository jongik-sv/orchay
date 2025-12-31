/**
 * PUT /api/config/basePath
 * 기본 경로 변경 (Hot reload)
 *
 * Task: 홈 디렉토리 선택 기능
 * CRIT-002: 경로 순회 공격 방지
 */

import { defineEventHandler, readBody, createError } from 'h3';
import { pathManager } from '../../utils/pathManager';
import { ensureOrchayStructure } from '../../utils/file';
import { refreshCache } from '../../utils/settings/_cache';
import {
  validateBasePath,
  checkOrchayExists,
} from '../../utils/validators/pathValidators';
import type { SetBasePathRequest, SetBasePathResponse } from '../../../types/appConfig';

/**
 * 기본 경로 변경
 *
 * 1. 경로 보안 검증
 * 2. 디렉토리 존재 확인
 * 3. PathManager 경로 변경
 * 4. 설정 캐시 무효화
 * 5. .orchay 구조 생성 (옵션)
 */
export default defineEventHandler(async (event): Promise<SetBasePathResponse> => {
  const body = await readBody<SetBasePathRequest>(event);

  // 1. 입력 검증
  if (!body?.basePath) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'basePath는 필수입니다',
    });
  }

  const { basePath, createIfMissing = true } = body;

  // 2. 경로 보안 검증 (CRIT-002)
  const validation = validateBasePath(basePath);
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: validation.error || '유효하지 않은 경로입니다',
    });
  }

  // 3. 디렉토리 존재 확인
  const exists = await checkOrchayExists(basePath);
  if (!exists.dirExists) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: `디렉토리를 찾을 수 없습니다: ${basePath}`,
    });
  }

  // 4. 쓰기 권한 확인
  if (!exists.isWritable) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `디렉토리에 쓰기 권한이 없습니다: ${basePath}`,
    });
  }

  // 5. 경로 변경 적용
  const previousPath = pathManager.basePath;
  try {
    pathManager.setBasePath(basePath);

    // 6. 설정 캐시 무효화 (pathManager.onPathChange 리스너로 자동 처리되지만 명시적으로도 호출)
    refreshCache();

    // 7. .orchay 존재 여부 확인
    if (!exists.orchayExists) {
      if (createIfMissing) {
        // 구조 생성
        const result = await ensureOrchayStructure();
        if (!result.success) {
          console.warn('[Config] Failed to create .orchay structure:', result.errors);
        }
      } else {
        // .orchay가 없으면 에러
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          message: `선택한 폴더에 .orchay가 없습니다. Orchay 프로젝트 폴더를 선택해주세요.`,
        });
      }
    }

    return {
      success: true,
      data: {
        previousPath,
        currentPath: pathManager.basePath,
        message: '홈 디렉토리가 변경되었습니다',
      },
    };
  } catch (error) {
    // 경로 변경 실패 시 롤백
    console.error('[Config] Failed to set base path:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : '경로 변경에 실패했습니다',
    });
  }
});
